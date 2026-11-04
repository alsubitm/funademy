/* Replaced at build time; no analytics, runtime caching, or access to progress. */
const CACHE = 'funademy-windmill-shell-__VERSION__';
const SHELL = '/windmill/index.html';
const ASSETS = __ASSETS__;
const allowed = new Set(ASSETS);
const PREFIX = 'funademy-windmill-shell-';
const PREDECESSORS = '/windmill/__offline_predecessors__';
let pruning;

async function predecessors() {
  const entry = await (await caches.open(CACHE)).match(PREDECESSORS);
  return entry ? await entry.json() : [];
}

function confirmCurrent(client) {
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = ok => { clearTimeout(timer); channel.port1.close(); resolve(ok); };
    // Frozen, legacy, or unresponsive tabs are NOT evidence that a copy is unused.
    const timer = setTimeout(() => finish(false), 2000);
    channel.port1.onmessage = event => finish(PREFIX + event.data?.version === CACHE);
    try { client.postMessage({ type: 'WINDMILL_SHELL_VERSION' }, [channel.port2]); }
    catch { finish(false); }
  });
}

function prune() {
  if (pruning) return pruning;
  pruning = (async () => {
    const candidates = await predecessors();
    if (!candidates.length) return;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const lessonTabs = windows.filter(client => {
      const url = new URL(client.url);
      return url.origin === self.location.origin && url.pathname.startsWith('/windmill/');
    });
    if (!(await Promise.all(lessonTabs.map(confirmCurrent))).every(Boolean)) return;
    // A tab created during the handshake might still be loading an older page.
    const after = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (after.some(client => new URL(client.url).pathname.startsWith('/windmill/') &&
      !lessonTabs.some(tab => tab.id === client.id))) return;
    for (const key of candidates) {
      if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
    }
  })().catch(() => { /* Storage/client failures defer cleanup, never lesson use. */ })
    .finally(() => { pruning = undefined; });
  return pruning;
}

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
  event.waitUntil((async () => {
    // Snapshot only predecessors at activation. Persist this list across worker
    // restarts; a future installing/waiting copy must never become a candidate.
    const keys = (await caches.keys()).filter(key => key.startsWith(PREFIX) && key !== CACHE);
    await (await caches.open(CACHE)).put(PREDECESSORS, new Response(JSON.stringify(keys)));
    await self.clients.claim();
    await prune();
  })());
});

self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
  if (event.data?.type === 'PRUNE_UNUSED') event.waitUntil(prune());
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
  const oldAsset = url.pathname.startsWith('/windmill/assets/');
  if (!shell && !allowed.has(url.pathname) && !oldAsset) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const hit = await cache.match(shell ? SHELL : url.pathname);
    if (hit) return hit;
    if (oldAsset) {
      // Only exact previously downloaded asset URLs; never cache runtime data.
      for (const key of await predecessors()) {
        if (!key.startsWith(PREFIX) || !(await caches.has(key))) continue;
        const oldHit = await (await caches.open(key)).match(url.pathname);
        if (oldHit) return oldHit;
      }
    }
    return fetch(request); // Never store runtime responses.
  })());
});
