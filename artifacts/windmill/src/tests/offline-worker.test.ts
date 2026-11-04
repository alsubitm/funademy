import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const assets = ['/windmill/index.html', '/windmill/assets/lab.js', '/windmill/fonts/font.ttf'];
function harness(fail = false, version = 'test', storage = new Map<string, Map<string, Response>>()) {
  const handlers: Record<string, (event: any) => void> = {};
  const stored = new Map<string, Response>();
  storage.set(`funademy-windmill-shell-${version}`, stored);
  let tabs: { id: string; url: string; postMessage: (message: any, ports: MessagePort[]) => void }[] = [];
  const fetched: Request[] = [];
  const deleted: string[] = [];
  let claimed = false;
  let skipped = false;
  const code = readFileSync(new URL('../../offline-worker.js', import.meta.url), 'utf8')
    .replace('__VERSION__', version).replace('__ASSETS__', JSON.stringify(assets));
  vm.runInNewContext(code, {
    self: { location: { origin: 'https://lesson.test' },
      addEventListener: (name: string, fn: any) => { handlers[name] = fn; },
      clients: { claim: async () => { claimed = true; }, matchAll: async () => tabs },
      skipWaiting: () => { skipped = true; },
    },
    URL,
    Response,
    MessageChannel,
    setTimeout,
    clearTimeout,
    Request: class extends Request {
      constructor(url: string, init?: RequestInit) { super(new URL(url, 'https://lesson.test'), init); }
    },
    caches: {
      keys: async () => [...storage.keys()],
      has: async (key: string) => storage.has(key),
      open: async (key: string) => {
        if (!storage.has(key)) storage.set(key, new Map());
        const entries = storage.get(key)!;
        return {
          put: async (url: string, response: Response) => { entries.set(url, response); },
          match: async (url: string) => entries.get(url)?.clone(),
        };
      },
      delete: async (key: string) => { deleted.push(key); storage.get(key)?.clear(); return storage.delete(key); },
    },
    fetch: async (req: Request) => { fetched.push(req); return new Response('lesson', { status: fail ? 503 : 200 }); },
  });
  async function lifecycle(name: string) {
    let work: Promise<unknown> = Promise.resolve();
    handlers[name]({ waitUntil: (p: Promise<unknown>) => { work = p; } });
    await work;
  }
  function fetchEvent(path: string, mode = 'cors', method = 'GET') {
    let response: Promise<Response> | undefined;
    handlers.fetch({ request: { url: new URL(path, 'https://lesson.test').href, mode, method },
      respondWith: (p: Promise<Response>) => { response = p; } });
    return response;
  }
  async function prune() {
    let work = Promise.resolve();
    handlers.message({ data: { type: 'PRUNE_UNUSED' }, waitUntil: (p: Promise<void>) => { work = p; } });
    await work;
  }
  function setTabs(versions: (string | null)[]) {
    tabs = versions.map((v, i) => ({
      id: String(i), url: 'https://lesson.test/windmill/',
      postMessage: (_: any, ports: MessagePort[]) => {
        if (v !== null) ports[0].postMessage({ version: v });
      },
    }));
  }
  return { handlers, stored, storage, fetched, deleted, lifecycle, fetchEvent, prune, setTabs,
    claimed: () => claimed, skipped: () => skipped };
}

test('install caches only explicit files anonymously; activation never forces an update', async () => {
  const h = harness();
  await h.lifecycle('install');
  assert.deepEqual([...h.stored.keys()], assets);
  assert.ok(h.fetched.every(r => r.credentials === 'omit' && r.cache === 'reload'));
  assert.equal(h.skipped(), false);
  await h.lifecycle('activate');
  assert.equal(h.claimed(), true);
  assert.deepEqual(h.deleted, []);
});
test('failed download removes partial cache and fails installation', async () => {
  const h = harness(true);
  await assert.rejects(h.lifecycle('install'));
  assert.equal(h.stored.size, 0);
  assert.deepEqual(h.deleted, ['funademy-windmill-shell-test']);
});
test('offline root and allowlisted assets are served without network', async () => {
  const h = harness();
  await h.lifecycle('install');
  assert.equal(await (await h.fetchEvent('/windmill/', 'navigate'))?.text(), 'lesson');
  assert.ok(await h.fetchEvent('/windmill/assets/lab.js'));
  assert.equal(h.fetched.length, assets.length);
});
test('main-site, private, unknown, cross-origin, query and non-GET requests bypass caching', () => {
  const h = harness();
  for (const url of ['/admin', '/account', '/booking', '/payment', '/svc/payments',
    '/windmill/admin', '/windmill/booking', '/windmill/unknown.js',
    'https://elsewhere.test/windmill/assets/lab.js', '/windmill/?secret=x',
    '/windmill/assets/lab.js?secret=x']) {
    assert.equal(h.fetchEvent(url, 'navigate'), undefined, url);
  }
  assert.equal(h.fetchEvent('/windmill/assets/lab.js', 'cors', 'POST'), undefined);
  assert.equal(h.stored.size, 0);
});
test('readiness detects eviction and update activates only on explicit message', async () => {
  const h = harness();
  await h.lifecycle('install');
  async function ready() {
    let result = false;
    let work: Promise<unknown> = Promise.resolve();
    h.handlers.message({ data: { type: 'CHECK_READY' }, ports: [{ postMessage: (data: any) => { result = data.ready; } }],
      waitUntil: (p: Promise<unknown>) => { work = p; } });
    await work;
    return result;
  }
  assert.equal(await ready(), true);
  h.stored.delete(assets[1]);
  assert.equal(await ready(), false);
  assert.equal(h.skipped(), false);
  h.handlers.message({ data: { type: 'ACTIVATE_UPDATE' } });
  assert.equal(h.skipped(), true);
});

test('multiple updates retain offline old tabs, then prune all unused copies only', async () => {
  const storage = new Map<string, Map<string, Response>>();
  storage.set('unrelated-cache', new Map([['/account', new Response('private')]]));
  const first = harness(false, 'v1', storage);
  await first.lifecycle('install');
  await first.lifecycle('activate');
  first.stored.set('/windmill/assets/old.js', new Response('old offline asset'));
  const second = harness(false, 'v2', storage);
  second.setTabs(['v1', 'v2']);
  await second.lifecycle('install');
  await second.lifecycle('activate');
  assert.deepEqual(second.deleted, []);
  const third = harness(false, 'v3', storage);
  third.setTabs(['v1', 'v2', 'v3']);
  await third.lifecycle('install');
  await third.lifecycle('activate');
  assert.deepEqual(third.deleted, []);
  assert.equal(await (await third.fetchEvent('/windmill/assets/old.js'))?.text(), 'old offline asset');
  assert.equal(third.fetched.length, assets.length);
  third.setTabs(['v3', 'v3']);
  // A newly installing/waiting version is not a predecessor.
  storage.set('funademy-windmill-shell-v4', new Map());
  await third.prune();
  assert.deepEqual([...storage.keys()].sort(),
    ['unrelated-cache', 'funademy-windmill-shell-v3', 'funademy-windmill-shell-v4'].sort());
  assert.equal(await storage.get('unrelated-cache')!.get('/account')!.text(), 'private');
});

test('legacy or frozen tabs defer pruning, including offline, until closed', async () => {
  const h = harness();
  h.storage.set('funademy-windmill-shell-legacy', new Map());
  h.setTabs([null, 'test']);
  await h.lifecycle('install');
  await h.lifecycle('activate');
  assert.deepEqual(h.deleted, []);
  h.setTabs([]);
  await h.prune();
  assert.deepEqual(h.deleted, ['funademy-windmill-shell-legacy']);
});
