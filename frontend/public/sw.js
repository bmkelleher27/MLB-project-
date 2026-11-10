// Minimal service worker: makes the app installable and load instantly on
// repeat visits by caching the built app shell. It deliberately never caches
// API or socket traffic — live game data must always come from the network.
const CACHE = 'mlb-scorecards-v2';
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

  // Hashed build assets are immutable — a changed file gets a new name — so a
  // cached copy is served as-is with no network request at all. Only a miss
  // goes to the network, and its response is stored for next time.
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((resp) => {
            // An HTML body here is the SPA fallback answering for an asset that no
            // longer exists; storing it would pin a broken script under that name.
            const isHtml = (resp.headers.get('content-type') || '').includes('text/html');
            if (resp.ok && !isHtml) {
              const copy = resp.clone();
              event.waitUntil(
                caches.open(CACHE).then((c) => c.put(request, copy).then(() => trimAssets(c))),
              );
            }
            return resp;
          }),
      ),
    );
  }
});

// Every deploy adds freshly named assets and nothing ever asks for the old
// ones again, so without a cap the cache grows by a full build per deploy.
// Cache keys come back in insertion order, so the oldest are dropped first.
const MAX_ASSETS = 80;

function trimAssets(cache) {
  return cache.keys().then((keys) => {
    const assets = keys.filter((k) => new URL(k.url).pathname.startsWith('/assets/'));
    const excess = assets.slice(0, Math.max(0, assets.length - MAX_ASSETS));
    return Promise.all(excess.map((k) => cache.delete(k)));
  });
}
