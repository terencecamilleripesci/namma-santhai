/* Namma Santhai service worker — NETWORK-FIRST, cache fallback.
   Bump CACHE on every deploy or the phone serves stale files. */
const CACHE = 'namma-santhai-v25';
const ASSETS = [
  './', './index.html', './css/styles.css', './js/app.js', './js/api.js',
  './manifest.json', './legal/privacy.html', './legal/terms.html', './assets/temple.svg', './assets/share-card.jpg', './assets/empty-listings.png', './assets/logo-badge.png',
  './assets/logo-lockup.png', './assets/logo-lockup-light.png',
  './assets/cat/cat-goat.png', './assets/cat/cat-other.png', './assets/cat/cat-bike.png', './assets/cat/cat-seeds.png', './assets/cat/cat-fruit.png', './assets/cat/cat-buffalo.png', './assets/cat/cat-sheep.png', './assets/cat/cat-cattle.png',
  './assets/cat/cat-poultry.png', './assets/cat/cat-feed.png', './assets/cat/cat-produce.png',
  './assets/cat/cat-machinery.png', './assets/cat/cat-vehicle.png',
  './icons/icon-192.png', './icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(() => {})));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});

/* ---------------- Web Push: fires with the app CLOSED ----------------
   The browser's push service wakes this worker even when no tab is open,
   which is the whole point - the in-app poller cannot do that. */
self.addEventListener('push', (e) => {
  let d = { title: 'Namma Santhai', body: '', url: './', tag: 'ns' };
  try { if (e.data) d = Object.assign(d, e.data.json()); }
  catch (_) { if (e.data) d.body = e.data.text(); }
  e.waitUntil(
    self.registration.showNotification(d.title, {
      body: d.body,
      icon: 'icons/icon-192.png',
      badge: 'icons/icon-192.png',
      tag: d.tag,
      renotify: true,
      data: { url: d.url || './' }
    })
  );
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || './';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // Focus an open window rather than stacking up new ones.
      for (const c of list) {
        if ('focus' in c) { c.focus(); if ('navigate' in c) c.navigate(target); return; }
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
