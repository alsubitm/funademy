/* Replaced at build time; no analytics, runtime caching, or access to progress. */
const CACHE = 'funademy-windmill-shell-__VERSION__';
const SHELL = '/windmill/index.html';
const ASSETS = __ASSETS__;
const allowed = new Set(ASSETS);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    // A partial download must never be advertised as offline ready.
    const cache = await caches.open(CACHE);
    try {
      for (const url of ASSETS) {
        const response = await fetch(new Request(url, { cache: 'reload', credentials: 'omit' }));
        if (!response.ok || response.redirected || response.type === 'opaque') throw new Error('Incomplete offline download');
        await cache.put(url, response);
      }
    } catch (error) {
      await caches.delete(CACHE);
      throw error;
    }
  })());
});

self.addEventListener('activate', event => {
  // Keep older bundles for existing lesson tabs; they are small, immutable and
  // removed explicitly by "Remove offline copy", never by a progress reset.
  event.waitUntil(self.clients.claim());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
  if (event.data?.type === 'CHECK_READY') {
    event.waitUntil((async () => {
      const cache = await caches.open(CACHE);
      const ready = (await Promise.all(ASSETS.map(url => cache.match(url)))).every(Boolean);
      event.ports[0]?.postMessage({ ready });
    })());
  }
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || url.search) return;
  // Exact lesson root only. /windmill/admin and every main-site route bypass us.
  const shell = request.mode === 'navigate' && (url.pathname === '/windmill/' || url.pathname === SHELL);
  if (!shell && !allowed.has(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(shell ? SHELL : url.pathname);
    return hit || fetch(request); // Never store runtime responses.
  })());
});
