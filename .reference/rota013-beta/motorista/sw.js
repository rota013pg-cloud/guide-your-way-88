// ═══════════════════════════════════════════════════════
//  SERVICE WORKER — Rota 013 Motorista — Beta 2.0
// ═══════════════════════════════════════════════════════

const CACHE   = 'rota013-motorista-v7';
const SHELL   = [
  '/motorista/',
  '/motorista/css/style.css',
  '/motorista/js/app.js',
  '/motorista/manifest.json'
];

// Instalar: pré-cachear shell
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(SHELL))
      .catch(() => {}) // não falhar se offline
  );
  self.skipWaiting();
});

// Ativar: limpar caches antigas
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE)
        .map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first para API, cache-first para shell
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;

  // API: sempre rede, nunca cachear
  if (e.request.url.includes('/api/')     ||
      e.request.url.includes('/socket.io') ||
      e.request.url.includes('maps.googleapis.com')) {
    return;
  }

  // Shell: network-first com fallback para cache
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

// ─── Push Notification ─────────────────────────────────
self.addEventListener('push', e => {
  let data = {};
  try { data = e.data?.json() || {}; } catch {}

  const title   = data.title || '🏍️ Rota 013';
  const body    = data.body  || 'Nova corrida disponível!';
  const options = {
    body,
    icon:    '/img/icon-192x192.png',
    badge:   '/img/icon-72x72.png',
    vibrate: [200, 100, 200, 100, 200],
    tag:     'rota013-corrida',
    renotify: true,
    requireInteraction: true,
    data:    data.data || {},
    actions: [
      { action: 'abrir', title: 'Ver corrida' }
    ]
  };

  e.waitUntil(self.registration.showNotification(title, options));
});

// ─── Clique na notificação ─────────────────────────────
self.addEventListener('notificationclick', e => {
  e.notification.close();

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        // Focar aba existente
        const client = list.find(c =>
          c.url.includes('/motorista') && 'focus' in c
        );
        if (client) return client.focus();
        // Abrir nova aba
        return clients.openWindow('/motorista/');
      })
  );
});
