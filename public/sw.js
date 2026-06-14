// =============================================
// CITHI PATHAN - SERVICE WORKER (sw.js)
// Handles push notifications & smart caching
// Version: v2 (update this version string when
// you deploy a site update so users get fresh files)
// =============================================

const CACHE_NAME = 'cithi-pathan-v2';

// Core files to cache for offline support
const CACHE_FILES = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/config.js',
  '/js/app.js',
  '/manifest.json'
];

// ---- Install: cache core files ----
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(CACHE_FILES))
  );
  // Activate immediately without waiting for old SW to stop
  self.skipWaiting();
});

// ---- Activate: clean up old caches ----
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    )
  );
  // Take control of all open pages immediately
  self.clients.claim();
});

// ---- Fetch: network-first for HTML, cache-first for assets ----
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith(self.location.origin)) return;

  const url = new URL(event.request.url);

  // API calls: always network, never cache
  if (url.pathname.startsWith('/api/')) return;

  // HTML pages: network-first (so site updates reach users)
  if (event.request.headers.get('accept') && event.request.headers.get('accept').includes('text/html')) {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Other assets (CSS, JS, icons): cache-first
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});

// ---- Push notification received ----
self.addEventListener('push', (event) => {
  let data = {
    title: '💌 চিঠি পাঠান',
    body:  'You have a new message!',
    url:   '/'
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch {
      data.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body:             data.body,
      icon:             '/icons/icon-192.png',
      badge:            '/icons/badge-72.png',
      tag:              'cithi-notification',   // same tag = replaces previous notification
      data:             { url: data.url || '/' },
      requireInteraction: false,
      vibrate:          [200, 100, 200]
    })
  );
});

// ---- Notification click: open website ----
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // Focus existing tab if open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      // Open new tab
      return clients.openWindow(url);
    })
  );
});

// ---- Message from main app (for manual cache clear on update) ----
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
