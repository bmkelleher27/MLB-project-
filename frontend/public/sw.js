// Minimal service worker: makes the app installable and load instantly on
// repeat visits by caching the built app shell. It deliberately never caches
// API or socket traffic — live game data must always come from the network.
const CACHE = 'mlb-scorecards-v1';
const APP_SHELL = ['/', '/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  // Drop caches from older versions so a new deploy doesn't serve stale assets.
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  // Only handle same-origin GETs; API (statsapi/backend) and sockets go straight
  // to the network so scores are never served from a cache.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network-first so new deploys appear immediately, falling back
  // to the cached shell when offline.
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).catch(() => caches.match('/index.html').then((r) => r || caches.match('/'))));
    return;
  }

  // Hashed build assets are immutable per build, so cache-first is safe and
  // instant; refresh the cache in the background for the next load.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request).then((resp) => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
          }
          return resp;
        });
        return cached || network;
      }),
    );
  }
});
