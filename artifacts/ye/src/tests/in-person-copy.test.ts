/**
 * Public copy guard: the existing catalog remains in person in Riyadh.
 * The homepage now separately and transparently advertises the January 2027
 * online course in preparation; keep that copy out of this legacy-copy scan.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';
import { CATALOG } from '@/lib/catalog';
import { copy } from '@/components/home3/data';
import { dict } from '@/lib/i18n';

const SRC = path.resolve(__dirname, '..');
const ONLINE_LEARNING = /live online|online class|online learning|learning platform|from anywhere|أونلاين|عبر الإنترنت|من أي مكان|منصة التعل|التعليم الإلكتروني/i;

const PUBLIC_FILES = [
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

describe('in-person public copy', () => {
  it('every catalog program is in person', () => {
    for (const [slug, spec] of Object.entries(CATALOG)) {
      expect(spec.formatEn, slug).toBe('In-person');
      expect(spec.formatAr, slug).toBe('حضوري');
    }
  });

  it('home hero note says in person in Riyadh', () => {
    expect(copy.en.heroNote).toMatch(/Live online.*Riyadh famil/);
    expect(copy.ar.heroNote).toMatch(/مباشر أونلاين.*عائلات الرياض/);
  });

  it('homepage presents the online course as a future course in preparation', () => {
    expect(copy.en.heroDescription).toMatch(/January 2027 online course is in preparation/);
    expect(copy.ar.heroDescription).toMatch(/دورة أونلاين لشهر يناير 2027/);
    const metadata = readFileSync(path.join(SRC, 'app/en/page.tsx'), 'utf8');
    expect(metadata).toMatch(/live, tutor-led online course for January 2027/);
    expect(metadata).toMatch(/current groups and prices/);
  });

  it('i18n banner and legend are in person', () => {
    expect(dict.en.topBanner).not.toMatch(ONLINE_LEARNING);
    expect(dict.ar.topBanner).not.toMatch(ONLINE_LEARNING);
    expect(dict.en.legendOnline).toBe('In-person');
    expect(dict.ar.legendOnline).toBe('حضوري');
  });

  for (const rel of PUBLIC_FILES) {
    it(`${rel} has no online-learning promotion`, () => {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      expect(src).not.toMatch(ONLINE_LEARNING);
      expect(src).not.toMatch(/['"]\/(en\/)?nelc['"]/);
    });
  }
});
