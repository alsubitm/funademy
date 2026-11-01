/**
 * NELC license display — rendering and module guards.
 *
 * Verifies:
 * 1. constants.ts reads NELC_LICENSE_NO from process.env at module-eval time.
 * 2. SiteFooter no longer publicly displays an e-learning license (FunAdemy
 *    programs are in person); the secret/records remain untouched.
 * 3. The retired public /nelc and /en/nelc pages redirect to contact.
 *
 * Note on deployment: license number changes always require a new deployment
 * (which Replit triggers automatically when a secret is added/updated). No
 * code change is needed.
 */
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';

// ── Mock heavy / Next.js-specific dependencies before any component import ──

vi.mock('next/navigation', () => ({
  permanentRedirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));

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
import { permanentRedirect } from 'next/navigation';

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
// 2. SiteFooter — public e-learning license display intentionally removed
// ---------------------------------------------------------------------------

describe('SiteFooter does not promote an e-learning license', () => {
  for (const lang of ['ar', 'en'] as const) {
    it(`${lang} footer omits the license even when NELC_LICENSE_NO is set`, () => {
      vi.stubEnv('NELC_LICENSE_NO', 'NELC-2026-99999');
      const html = renderToStaticMarkup(React.createElement(SiteFooter, { lang }));
      expect(html).not.toContain('NELC-2026-99999');
      expect(html).not.toContain('NELC license no.');
      expect(html).not.toContain('ترخيص المركز الوطني');
      expect(html).not.toContain('/nelc');
    });
  }
});

// ---------------------------------------------------------------------------
// 3. Retired public NELC pages redirect to contact
// ---------------------------------------------------------------------------

describe('Retired NELC pages redirect to contact', () => {
  it('/nelc permanently redirects to /contact', () => {
    expect(() => NelcPageAr()).toThrow();
    expect(permanentRedirect).toHaveBeenCalledWith('/contact');
  });

  it('/en/nelc permanently redirects to /en/contact', () => {
    expect(() => NelcPageEn()).toThrow();
    expect(permanentRedirect).toHaveBeenCalledWith('/en/contact');
  });
});
