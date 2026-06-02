const CACHE = 'rota013-beta-v1';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => { self.clients.claim(); });
self.addEventListener('fetch', e => {
  if (e.request.url.includes('/beta/api') || e.request.url.includes('/socket.io')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
