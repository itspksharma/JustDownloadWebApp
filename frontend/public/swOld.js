// Very small SW with safe defaults for Vite SPA
const CACHE_STATIC = 'static-v1';

// Never touch API or downloads
const shouldBypass = (url) => {
  return url.pathname.startsWith('/api') || url.pathname.startsWith('/downloads');
};

// Install: warm-cache minimal static (optional)
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_STATIC)); // create cache
});

// Activate: drop old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_STATIC).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - /api, /downloads -> network only (no cache)
// - /index.html -> network-first (avoid stale app shell)
// - other static assets -> cache-first (hashed files)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  if (shouldBypass(url)) {
    return; // let it hit network directly
  }

  // Always try network for HTML shell
  const isHTML = event.request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('/index.html');
  if (isHTML) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          // don't cache HTML; rely on server headers
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // cache-first for static assets
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        const copy = res.clone();
        // only cache GET + ok responses for same-origin assets
        if (res.ok && event.request.method === 'GET' && url.origin === self.location.origin) {
          caches.open(CACHE_STATIC).then((cache) => cache.put(event.request, copy));
        }
        return res;
      });
    })
  );
});
