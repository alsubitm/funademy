/**
 * Public copy guard: FunAdemy programs are in person in Riyadh.
 * Fails if public home/catalog/footer/legal copy promotes online learning.
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
  'components/home3/data.ts',
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
  'app/en/page.tsx',
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
    expect(copy.en.heroNote).toMatch(/In-person in Riyadh/);
    expect(copy.ar.heroNote).toMatch(/حضوري في الرياض/);
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
