// Begeister service worker — push-notificaties + altijd verse app (v5).
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil((async () => {
  // Ruim oude caches op zodat een verouderde index.html op iOS niet blijft hangen.
  try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch (_) {}
  await self.clients.claim();
})()));

// Network-first voor navigaties: haal de nieuwste index.html op zodat updates
// meteen verschijnen (iOS PWA houdt anders de oude versie vast).
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() =>
        caches.match(req).then((r) => r || caches.match('/'))
      )
    );
  }
});

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; }
  catch (_) { d = { body: event.data ? event.data.text() : '' }; }
  const title = d.title || 'Begeister';
  const options = {
    body: d.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: d.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          // App staat al open: focussen en het adres doorgeven (de app opent dan het item).
          try { c.postMessage({ type: 'openUrl', url }); } catch (_) {}
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});
