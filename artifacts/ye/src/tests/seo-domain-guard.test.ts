/**
 * SEO domain guard: the rendered HTML of the Arabic and English homepages,
 * the sitemap, and robots.txt must only ever reference the canonical
 * public domain (funademy.io) — never a replit.app / replit.dev domain.
 *
 * Before site-url.ts centralized this, REPLIT_DOMAINS leaked into
 * canonicals/OG/hreflang/JSON-LD and polluted Google's index. This test
 * boots a real `next dev` server with a hermetic env (unreachable DB —
 * pages must render via their safeQuery fallbacks, which the
 * build-resilience suite guarantees) and scans the SEO-bearing surface of
 * the real rendered output so a future regression fails the ye-tests
 * workflow.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn, type ChildProcess } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const YE_ROOT = path.resolve(__dirname, '..', '..');
const UNREACHABLE_DB_URL = 'postgresql://nouser:nopass@127.0.0.1:5999/nodb';
const DIST_DIR = '.next-seo-guard-test';
const CANONICAL_ORIGIN = 'https://funademy.io';
const STARTUP_TIMEOUT_MS = 180_000;
const SUITE_TIMEOUT_MS = 240_000;

const PORT = 4300 + Math.floor(Math.random() * 500);
const BASE = `http://127.0.0.1:${PORT}`;

let server: ChildProcess | null = null;
let serverLog = '';

/**
 * Hermetic env whitelist (same rationale as build-resilience.test.ts):
 * vitest/pnpm lifecycle vars corrupt a nested next process, and ambient
 * REPLIT_DOMAINS / SITE_URL must not mask a hardcoding regression.
 */
function childEnv(): NodeJS.ProcessEnv {
  const keep = ['PATH', 'HOME', 'TMPDIR', 'SHELL', 'USER', 'LANG', 'LC_ALL', 'TZ'];
  const env: Record<string, string> = {};
  for (const k of keep) {
    const v = process.env[k];
    if (v !== undefined) env[k] = v;
  }
  env.DATABASE_URL = UNREACHABLE_DB_URL;
  env.NEXT_TELEMETRY_DISABLED = '1';
  env.NEXT_DIST_DIR = DIST_DIR;
  env.PORT = String(PORT);
  // Deliberately set a replit-looking REPLIT_DOMAINS: if any SEO code path
  // ever derives URLs from it again, the scan below catches it.
  env.REPLIT_DOMAINS = 'seo-guard-canary.replit.dev';
  env.REPLIT_DEV_DOMAIN = 'seo-guard-canary.replit.dev';
  return env as unknown as NodeJS.ProcessEnv;
}

async function fetchText(pathname: string): Promise<string> {
  // Next.js streams metadata outside <head> for ordinary visitors. Request
  // the HTML-limited crawler response so seoSurface checks the blocking
  // <head> metadata that social crawlers actually receive.
  const res = await fetch(`${BASE}${pathname}`, {
    redirect: 'follow',
    headers: { 'User-Agent': 'Twitterbot/1.0' },
  });
  expect(res.ok, `${pathname} responded ${res.status}`).toBe(true);
  return res.text();
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  for (;;) {
    if (server?.exitCode !== null && server?.exitCode !== undefined) {
      throw new Error(`next dev exited early (code ${server.exitCode}).\n${serverLog.slice(-4000)}`);
    }
    try {
      const res = await fetch(`${BASE}/`, { redirect: 'manual' });
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    if (Date.now() > deadline) {
      throw new Error(`next dev did not become reachable within ${STARTUP_TIMEOUT_MS}ms.\n${serverLog.slice(-4000)}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}

/** Extract the SEO-bearing parts of a rendered page: <head> plus JSON-LD scripts. */
function seoSurface(html: string): string {
  const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] ?? '';
  const jsonLd = html.match(/<script[^>]*application\/ld\+json[^>]*>[\s\S]*?<\/script>/gi)?.join('\n') ?? '';
  return `${head}\n${jsonLd}`;
}

function expectNoReplit(surface: string, label: string): void {
  const hits = surface.match(/[^"'\s>]*replit[^"'\s<]*/gi) ?? [];
  expect(hits, `${label} leaks a replit domain into SEO tags: ${hits.slice(0, 5).join(', ')}`).toEqual([]);
}

beforeAll(async () => {
  server = spawn(
    path.join(YE_ROOT, 'node_modules', '.bin', 'next'),
    ['dev', '-H', '127.0.0.1', '-p', String(PORT)],
    { cwd: YE_ROOT, env: childEnv(), stdio: ['ignore', 'pipe', 'pipe'] },
  );
  server.stdout?.on('data', (d) => (serverLog += d));
  server.stderr?.on('data', (d) => (serverLog += d));
  await waitForServer();
}, STARTUP_TIMEOUT_MS + 10_000);

afterAll(async () => {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await new Promise((r) => setTimeout(r, 1500));
    if (server.exitCode === null) server.kill('SIGKILL');
  }
  // The nested next dev writes its own distDir and rewrites the TRACKED
  // next-env.d.ts (and reorders tsconfig include). Clean up so test runs
  // never leave generated-file drift (same pattern as build-resilience).
  await rm(path.join(YE_ROOT, DIST_DIR), { recursive: true, force: true });
  const nextEnvPath = path.join(YE_ROOT, 'next-env.d.ts');
  const nextEnv = await readFile(nextEnvPath, 'utf8').catch(() => null);
  if (nextEnv && nextEnv.includes(DIST_DIR)) {
    await writeFile(nextEnvPath, nextEnv.split(`/${DIST_DIR}/`).join('/.next/'));
  }
});

describe('SEO domain guard (rendered pages must only reference funademy.io)', () => {
  it(
    'Arabic homepage head/JSON-LD uses funademy.io and never replit',
    async () => {
      const surface = seoSurface(await fetchText('/'));
      expectNoReplit(surface, 'Arabic homepage');
      // canonical + og:url must exist and point at the canonical origin
      expect(surface).toMatch(new RegExp(`<link[^>]+rel="canonical"[^>]+href="${CANONICAL_ORIGIN}`));
      expect(surface).toMatch(new RegExp(`property="og:url"[^>]+content="${CANONICAL_ORIGIN}`));
      // hreflang alternates, if present, must also be canonical
      for (const m of surface.matchAll(/hreflang="[^"]*"[^>]*href="([^"]+)"/g)) {
        expect(m[1].startsWith(CANONICAL_ORIGIN), `hreflang href ${m[1]}`).toBe(true);
      }
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'English homepage head/JSON-LD uses funademy.io and never replit',
    async () => {
      const surface = seoSurface(await fetchText('/en'));
      expectNoReplit(surface, 'English homepage');
      expect(surface).toMatch(new RegExp(`<link[^>]+rel="canonical"[^>]+href="${CANONICAL_ORIGIN}`));
      expect(surface).toMatch(new RegExp(`property="og:url"[^>]+content="${CANONICAL_ORIGIN}`));
      for (const m of surface.matchAll(/hreflang="[^"]*"[^>]*href="([^"]+)"/g)) {
        expect(m[1].startsWith(CANONICAL_ORIGIN), `hreflang href ${m[1]}`).toBe(true);
      }
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'sitemap.xml lists only funademy.io URLs (covers every indexed page)',
    async () => {
      const xml = await fetchText('/sitemap.xml');
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      expect(locs.length).toBeGreaterThan(0);
      for (const loc of locs) {
        expect(loc.startsWith(`${CANONICAL_ORIGIN}/`) || loc === CANONICAL_ORIGIN, `sitemap loc ${loc}`).toBe(true);
      }
      expect(xml).not.toMatch(/replit/i);
    },
    SUITE_TIMEOUT_MS,
  );

  it(
    'robots.txt references only funademy.io',
    async () => {
      const txt = await fetchText('/robots.txt');
      expect(txt).not.toMatch(/replit/i);
      expect(txt).toContain(CANONICAL_ORIGIN);
    },
    SUITE_TIMEOUT_MS,
  );
});
