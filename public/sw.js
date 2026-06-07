/**
 * ═══════════════════════════════════════════════════════
 *  CITHI PATHAN — sw.js (Service Worker)
 *  Handles: PWA caching, Push Notifications, Background Sync
 * ═══════════════════════════════════════════════════════
 */

'use strict';

/* ──────────────────────────────────────────────────────
   CACHE CONFIG — update CACHE_VERSION when deploying new files
────────────────────────────────────────────────────── */
const CACHE_VERSION = 'cithi-v1.0';
const CACHE_ASSETS  = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

/* ══════════════════════════════════════
   INSTALL EVENT — cache static assets
══════════════════════════════════════ */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* ══════════════════════════════════════
   ACTIVATE EVENT — clean old caches
══════════════════════════════════════ */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_VERSION)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ══════════════════════════════════════
   FETCH EVENT — serve from cache, fallback to network
══════════════════════════════════════ */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and API routes
  if (request.method !== 'GET' || url.pathname.startsWith('/api/')) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        // Cache successful responses for same-origin requests
        if (response.ok && url.origin === self.location.origin) {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then(c => c.put(request, clone));
        }
        return response;
      }).catch(() => {
        // Offline fallback — return cached index.html for navigation
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});

/* ══════════════════════════════════════
   PUSH EVENT — show notification
══════════════════════════════════════ */
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: '💌 চিঠি পাঠান', body: event.data?.text() || 'নতুন বার্তা এসেছে!' };
  }

  const title   = data.title   || '💌 চিঠি পাঠান — Cithi Pathan';
  const body    = data.body    || 'You Have Received New Notification From Admin – Click To Open';
  const icon    = data.icon    || '/icons/icon-192.png';
  const badge   = data.badge   || '/icons/badge.png';
  const tag     = data.tag     || 'cithi-notification';
  const url     = data.url     || '/';

  const options = {
    body,
    icon,
    badge,
    tag,
    requireInteraction: false,
    vibrate: [200, 100, 200],
    data: { url },
    actions: [
      { action: 'open',  title: '📖 Open' },
      { action: 'close', title: '❌ Dismiss' }
    ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

/* ══════════════════════════════════════
   NOTIFICATION CLICK — open the website
══════════════════════════════════════ */
self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'close') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(clientList => {
        // Focus existing window if open
        for (const client of clientList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        // Open new window
        if (clients.openWindow) return clients.openWindow(targetUrl);
      })
  );
});

/* ══════════════════════════════════════
   MESSAGE EVENT — communication with app.js
══════════════════════════════════════ */
self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});
