// Service Worker for Secret Message Box
const CACHE_NAME = 'secretmsg-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(clients.claim());
});

self.addEventListener('fetch', (e) => {
  if (e.request.url.includes('/api/')) return; // Don't cache API calls
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});

self.addEventListener('push', (e) => {
  let data = {};
  try { data = e.data.json(); } catch(err) { data = { title: '💌 নতুন Message!', body: 'Admin আপনাকে reply করেছেন।' }; }

  e.waitUntil(
    self.registration.showNotification(data.title || '💌 Secret Message Box', {
      body: data.body || 'নতুন message এসেছে!',
      icon: '/icon.png',
      badge: '/icon.png',
      tag: 'secret-reply',
      requireInteraction: true,
      vibrate: [200, 100, 200],
      data: { url: '/' }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      for (const client of clientList) {
        if (client.url === '/' && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
