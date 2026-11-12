/**
 * Preserve historical in-person catalog/legal copy while allowing the
 * approved January 2027 tutor-led online direction on the new homepage.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { CATALOG } from '@/lib/catalog';
import { copy } from '@/components/home3/data';
import { dict } from '@/lib/i18n';

const SRC = path.resolve(__dirname, '..');
const ONLINE_LEARNING = /live online|online class|online learning|learning platform|from anywhere|أونلاين|عبر الإنترنت|من أي مكان|منصة التعل|التعليم الإلكتروني/i;

const LEGACY_PUBLIC_FILES = [
  'lib/i18n.ts',
  'lib/catalog.ts',
  'components/SiteFooter.tsx',
  'components/home/Hero.tsx',
  'components/home/Territory.tsx',
  'components/home/Pricing.tsx',
  'components/home/Platforms.tsx',
  'components/LiveTicker.tsx',
  'app/(ar)/contact/dict.ts',
  'app/(ar)/terms/page.tsx',
  'app/en/terms/page.tsx',
  'app/(ar)/layout.tsx',
  'app/en/layout.tsx',
  'app/llms.txt/route.ts',
  'app/sitemap.ts',
];

const ONLINE_HOME_FILES = [
  'components/home3/data.ts',
  'components/home3/OnlineCourse.tsx',
  'app/(ar)/page.tsx',
  'app/en/page.tsx',
];

describe('public copy during the online-course transition', () => {
  it('preserves the historical in-person catalog', () => {
    for (const [slug, spec] of Object.entries(CATALOG)) {
      expect(spec.formatEn, slug).toBe('In-person');
      expect(spec.formatAr, slug).toBe('حضوري');
    }
  });

  it('home hero describes live tutor-led online classes for Riyadh families', () => {
    expect(copy.en.heroNote).toMatch(/Live online, tutor-led.*Riyadh/);
    expect(copy.ar.heroNote).toMatch(/مباشر أونلاين مع مدرّب.*الرياض/);
  });

  it('preserves the legacy in-person banner and legend', () => {
    expect(dict.en.topBanner).not.toMatch(ONLINE_LEARNING);
    expect(dict.ar.topBanner).not.toMatch(ONLINE_LEARNING);
    expect(dict.en.legendOnline).toBe('In-person');
    expect(dict.ar.legendOnline).toBe('حضوري');
  });

  for (const rel of LEGACY_PUBLIC_FILES) {
    it(`${rel} has no online-learning promotion`, () => {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      expect(src).not.toMatch(ONLINE_LEARNING);
      expect(src).not.toMatch(/['"]\/(en\/)?nelc['"]/);
    });
  }

  for (const rel of ONLINE_HOME_FILES) {
    it(`${rel} supports online courses without promoting NELC compliance`, () => {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      expect(src).toMatch(ONLINE_LEARNING);
      expect(src).not.toMatch(/['"]\/(en\/)?nelc['"]/);
    });
  }

  it('both homepage descriptions identify January 2027 as in preparation', () => {
    expect(copy.en.heroDescription).toMatch(/January 2027 online course is in preparation/);
    expect(copy.ar.heroDescription).toMatch(/دورة أونلاين لشهر يناير 2027/);
    const en = readFileSync(path.join(SRC, 'app/en/page.tsx'), 'utf8');
    const ar = readFileSync(path.join(SRC, 'app/(ar)/page.tsx'), 'utf8');
    expect(en).toMatch(/preparing.*January 2027/);
    expect(en).toMatch(/live, tutor-led online course for January 2027/);
    expect(en).toMatch(/current groups and prices/);
    expect(ar).toMatch(/تجهّز.*يناير 2027/);
    const course = readFileSync(path.join(SRC, 'components/home3/OnlineCourse.tsx'), 'utf8');
    expect(course).toContain("status: 'January 2027 course in preparation'");
    expect(course).toContain("status: 'دورة يناير 2027 قيد التجهيز'");
  });
});
