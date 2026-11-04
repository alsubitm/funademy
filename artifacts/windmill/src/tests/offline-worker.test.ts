import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const assets = ['/windmill/index.html', '/windmill/assets/lab.js', '/windmill/fonts/font.ttf'];
function harness(fail = false) {
  const handlers: Record<string, (event: any) => void> = {};
  const stored = new Map<string, Response>();
  const fetched: Request[] = [];
  const deleted: string[] = [];
  let claimed = false;
  let skipped = false;
  const code = readFileSync(new URL('../../offline-worker.js', import.meta.url), 'utf8')
    .replace('__VERSION__', 'test').replace('__ASSETS__', JSON.stringify(assets));
  vm.runInNewContext(code, {
    self: { location: { origin: 'https://lesson.test' },
      addEventListener: (name: string, fn: any) => { handlers[name] = fn; },
      clients: { claim: async () => { claimed = true; } },
      skipWaiting: () => { skipped = true; },
    },
    URL,
    Request: class extends Request {
      constructor(url: string, init?: RequestInit) { super(new URL(url, 'https://lesson.test'), init); }
    },
    caches: {
      open: async () => ({
        put: async (url: string, response: Response) => { stored.set(url, response); },
        match: async (url: string) => stored.get(url),
      }),
      delete: async (key: string) => { deleted.push(key); stored.clear(); },
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
  return { handlers, stored, fetched, deleted, lifecycle, fetchEvent, claimed: () => claimed, skipped: () => skipped };
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
