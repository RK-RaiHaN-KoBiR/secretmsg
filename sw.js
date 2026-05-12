// ============================================================
// 🔔 Secret Message Box — Service Worker
// Push Notifications + Background Sync
// ============================================================

const CACHE_NAME = 'secretmsg-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/app.js',
  '/js/notifications.js',
  '/manifest.json'
];

// ── Install ──────────────────────────────────────────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// ── Activate ─────────────────────────────────────────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch (Cache-First for static, Network-First for API) ────
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (url.pathname.startsWith('/api/')) {
    // Network-first for API routes
    event.respondWith(
      fetch(event.request).catch(() =>
        new Response(JSON.stringify({ error: 'Offline' }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
    );
    return;
  }

  // Cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return cached || fetch(event.request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, clone));
        }
        return response;
      });
    })
  );
});

// ── Push Notification ─────────────────────────────────────────
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: '💌 Secret Message Box', body: event.data ? event.data.text() : 'New message!' };
  }

  const options = {
    body: data.body || 'আপনার একটি নতুন বার্তা এসেছে! 💌',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: data.tag || 'secretmsg-' + Date.now(),
    renotify: true,
    requireInteraction: false,
    vibrate: [200, 100, 200, 100, 200],
    data: {
      url: data.url || '/',
      messageId: data.messageId || null,
      timestamp: data.timestamp || Date.now()
    },
    actions: [
      { action: 'open', title: '📖 Open', icon: '/icons/icon-open.png' },
      { action: 'dismiss', title: '✖ Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(
      data.title || '💌 নতুন বার্তা এসেছে!',
      options
    )
  );
});

// ── Notification Click ────────────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url || '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

// ── Background Sync (polling for replies) ────────────────────
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'CHECK_REPLIES') {
    checkForReplies(event.data.userId);
  }
});

async function checkForReplies(userId) {
  if (!userId) return;
  try {
    const res = await fetch(`/api/get-reply?userId=${userId}`);
    const data = await res.json();
    if (data.hasNewReply && data.reply) {
      await self.registration.showNotification('💌 Admin থেকে Reply এসেছে!', {
        body: data.reply.message.substring(0, 100) + (data.reply.message.length > 100 ? '...' : ''),
        icon: '/icons/icon-192.png',
        badge: '/icons/badge-72.png',
        tag: 'reply-' + userId,
        renotify: true,
        vibrate: [300, 100, 300],
        data: { url: '/', messageId: data.reply.id }
      });
    }
  } catch (e) {
    // Silently fail
  }
}

// ── Periodic Background Sync ──────────────────────────────────
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-replies') {
    event.waitUntil(
      self.clients.matchAll().then(async (clients) => {
        // Get userId from IndexedDB if available
        // Fallback: notify all windows to check
        for (const client of clients) {
          client.postMessage({ type: 'POLL_REPLIES' });
        }
      })
    );
  }
});
