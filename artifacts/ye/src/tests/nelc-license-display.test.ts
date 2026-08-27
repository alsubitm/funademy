/**
 * NELC license display — rendering and module guards.
 *
 * Verifies:
 * 1. constants.ts reads NELC_LICENSE_NO from process.env at module-eval time.
 * 2. SiteFooter renders the license number when the env var is set, and
 *    renders nothing (no placeholder) when it is unset — via actual React
 *    server rendering, not a source scan.
 * 3. Both NELC pages export `dynamic = 'force-dynamic'` so Next.js does not
 *    statically bake an empty string into the page at build time.
 *
 * Note on deployment: license number changes always require a new deployment
 * (which Replit triggers automatically when a secret is added/updated). No
 * code change is needed.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

// ── Mock heavy / Next.js-specific dependencies before any component import ──

vi.mock('next/link', () => ({
  default: () => null,
}));

vi.mock('@/components/brand/FunAdemyMark', () => ({
  KiteMark: () => null,
  Wordmark: () => null,
}));

vi.mock('@/components/brand/YELogo', () => ({
  YELogo: () => null,
}));

vi.mock('@/lib/i18n', () => ({
  dict: {
    ar: {
      navPrograms: 'البرامج',
      navPricing: 'الأسعار',
    },
    en: {
      navPrograms: 'Programs',
      navPricing: 'Pricing',
    },
  },
}));

vi.mock('@/lib/brand', () => ({
  BRAND: {
    taglineAr: 'تعلّم وابتكر',
    taglineEn: 'Learn & Innovate',
    creditLine: 'FunAdemy',
    copyright: (y: number) => `© ${y}`,
    legoDisclaimer: 'LEGO is a trademark.',
  },
}));

vi.mock('@/components/legal/LegalShell', () => ({
  // Render children so page-level tests can assert on page body content.
  // (Return children directly — vi.mock factories are hoisted, so we avoid
  // referencing the React import binding here.)
  LegalShell: ({ children }: { children?: unknown }) => children ?? null,
}));

/**
 * @/lib/constants is mocked with getters so that each test can control the
 * value of NELC_LICENSE_NO via vi.stubEnv without needing vi.resetModules().
 */
vi.mock('@/lib/constants', () => ({
  get NELC_LICENSE_NO() {
    return process.env.NELC_LICENSE_NO ?? '';
  },
  PHONE_DISPLAY: '+966 50 555 1021',
  WHATSAPP_NUMBER: '966505551021',
  EMAIL: 'ceo@example.com',
  waLink: (msg: string) => `https://wa.me/966505551021?text=${encodeURIComponent(msg)}`,
  WA_DEFAULT_AR: 'مرحباً',
}));

// ── Actual imports come after vi.mock declarations ──

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SiteFooter } from '@/components/SiteFooter';
import NelcPageAr from '@/app/(ar)/nelc/page';
import NelcPageEn from '@/app/en/nelc/page';

const SRC = path.resolve(__dirname, '..');

afterEach(() => {
  vi.unstubAllEnvs();
});

// ---------------------------------------------------------------------------
// 1. constants.ts env-var reading
// ---------------------------------------------------------------------------

describe('NELC_LICENSE_NO constant', () => {
  it('is empty string when NELC_LICENSE_NO env var is unset', async () => {
    vi.stubEnv('NELC_LICENSE_NO', '');
    vi.resetModules();
    const { NELC_LICENSE_NO } = await import('@/lib/constants');
    expect(NELC_LICENSE_NO).toBe('');
  });

  it('returns the env var value when NELC_LICENSE_NO is set', async () => {
    vi.stubEnv('NELC_LICENSE_NO', 'TEST-LIC-001');
    vi.resetModules();
    const { NELC_LICENSE_NO } = await import('@/lib/constants');
    expect(NELC_LICENSE_NO).toBe('TEST-LIC-001');
  });
});

// ---------------------------------------------------------------------------
// 2. SiteFooter rendering — set and unset states
// ---------------------------------------------------------------------------

describe('SiteFooter NELC license display', () => {
  it('shows the license number in the footer when NELC_LICENSE_NO is set', () => {
    vi.stubEnv('NELC_LICENSE_NO', 'NELC-2026-99999');
    const html = renderToStaticMarkup(React.createElement(SiteFooter, { lang: 'ar' }));
    expect(html).toContain('NELC-2026-99999');
  });

  it('shows the license number in the English footer when NELC_LICENSE_NO is set', () => {
    vi.stubEnv('NELC_LICENSE_NO', 'NELC-2026-99999');
    const html = renderToStaticMarkup(React.createElement(SiteFooter, { lang: 'en' }));
    expect(html).toContain('NELC-2026-99999');
    expect(html).toContain('NELC license no.');
  });

  it('renders nothing for the license when NELC_LICENSE_NO is unset', () => {
    vi.stubEnv('NELC_LICENSE_NO', '');
    const html = renderToStaticMarkup(React.createElement(SiteFooter, { lang: 'ar' }));
    // No license number and no misleading placeholder text
    expect(html).not.toContain('ترخيص المركز الوطني');
    expect(html).not.toContain('NELC license no.');
    expect(html).not.toContain('قيد الإعداد');
  });
});

// ---------------------------------------------------------------------------
// 3. NELC pages (/nelc and /en/nelc) rendering — set and unset states
// ---------------------------------------------------------------------------

describe('NELC pages license status block', () => {
  it('/nelc shows the license number when NELC_LICENSE_NO is set', () => {
    vi.stubEnv('NELC_LICENSE_NO', 'NELC-2026-12345');
    const html = renderToStaticMarkup(React.createElement(NelcPageAr));
    expect(html).toContain('NELC-2026-12345');
    expect(html).toContain('مرخصة');
    expect(html).not.toContain('قيد الإعداد');
  });

  it('/en/nelc shows the license number when NELC_LICENSE_NO is set', () => {
    vi.stubEnv('NELC_LICENSE_NO', 'NELC-2026-12345');
    const html = renderToStaticMarkup(React.createElement(NelcPageEn));
    expect(html).toContain('NELC-2026-12345');
    expect(html).toContain('Licensed');
    expect(html).not.toContain('In preparation');
  });

  it('/nelc shows «قيد الإعداد» and no license number when unset', () => {
    vi.stubEnv('NELC_LICENSE_NO', '');
    const html = renderToStaticMarkup(React.createElement(NelcPageAr));
    expect(html).toContain('قيد الإعداد');
    expect(html).not.toContain('مرخصة ✅');
  });

  it('/en/nelc shows "In preparation" and no license number when unset', () => {
    vi.stubEnv('NELC_LICENSE_NO', '');
    const html = renderToStaticMarkup(React.createElement(NelcPageEn));
    expect(html).toContain('In preparation');
    expect(html).not.toContain('Licensed ✅');
  });
});

// ---------------------------------------------------------------------------
// 4. force-dynamic export guard (source scan — structural safety net)
// ---------------------------------------------------------------------------

const NELC_PAGES = [
  'app/(ar)/nelc/page.tsx',
  'app/en/nelc/page.tsx',
] as const;

describe('NELC pages are force-dynamic (not statically prerendered at build time)', () => {
  for (const rel of NELC_PAGES) {
    it(`${rel} exports dynamic = 'force-dynamic'`, () => {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      expect(
        src.includes("dynamic = 'force-dynamic'") || src.includes('dynamic = "force-dynamic"'),
        `${rel}: \`export const dynamic = 'force-dynamic'\` is missing — Next.js will statically ` +
          `prerender this page at build time, baking in an empty license string. The license ` +
          `status block will show "in preparation" until a new deployment even after the ` +
          `NELC_LICENSE_NO secret is set (which Replit triggers automatically when a ` +
          `secret is added/updated).`,
      ).toBe(true);
    });
  }
});
