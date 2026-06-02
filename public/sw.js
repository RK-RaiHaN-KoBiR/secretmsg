/* ====== SERVICE WORKER — sw.js ====== */
const CACHE_NAME = 'cithipathan-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Network first for API, cache first for assets
  if (e.request.url.includes('/api/')) {
    e.respondWith(fetch(e.request).catch(() => new Response(JSON.stringify({ ok: false }), { headers: { 'Content-Type': 'application/json' } })));
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request))
  );
});

/* Push notification handler */
self.addEventListener('push', e => {
  let data = { title: '📩 চিঠি পাঠান', body: 'You Have Received New Notification From Admin – Click To Open', url: '/' };
  if (e.data) {
    try { data = { ...data, ...e.data.json() }; } catch {}
  }
  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-72.png',
      tag: 'cithi-msg-' + Date.now(),
      requireInteraction: true,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url === url && 'focus' in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

/* Background sync for messages */
self.addEventListener('sync', e => {
  if (e.tag === 'sync-messages') {
    e.waitUntil(syncMessages());
  }
});

async function syncMessages() {
  // Sync any pending messages
  const cache = await caches.open('cithi-sync');
  const keys = await cache.keys();
  for (const req of keys) {
    try {
      const data = await (await cache.match(req)).json();
      await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      await cache.delete(req);
    } catch {}
  }
}
