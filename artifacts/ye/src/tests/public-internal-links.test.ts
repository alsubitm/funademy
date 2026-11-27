import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bricks', () => ({ getBrickCount: vi.fn(async () => 0) }));
vi.mock('next/navigation', () => ({ usePathname: () => '/en/watanona' }));

import { WatanonaPage } from '@/app/(ar)/watanona/WatanonaPage';
import { watanonaDict } from '@/app/(ar)/watanona/dictionary';
import { FunHome } from '@/components/home3/FunHome';
import { SiteFooter } from '@/components/SiteFooter';
import { curriculumPrograms } from '@/config/curriculum';

// Inspect HTML emitted without running effects or interacting with the page:
// these links must be available to crawlers, not only after opening a dialog.
const anchors = (html: string) => [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)]
  .map(([, attributes, text]) => ({
    href: attributes.match(/\bhref="([^"]*)"/)?.[1],
    text: text.replace(/<[^>]*>/g, ''),
  }));

describe('public internal links', () => {
  it('keeps explicit program detail slugs aligned with published route slugs', () => {
    const seed = readFileSync(path.resolve(__dirname, '../../prisma/seed.ts'), 'utf8');
    const slugs = [...seed.matchAll(/\bslug: '([^']+)'/g)].map((match) => match[1]);
    expect(curriculumPrograms()).toHaveLength(7);
    for (const program of curriculumPrograms()) expect(slugs).toContain(program.detailSlug);
  });

  for (const lang of ['ar', 'en'] as const) {
    const prefix = lang === 'en' ? '/en' : '';

    it(`${lang}: campaign enrollment links to booking in the same language`, async () => {
      const html = renderToStaticMarkup(await WatanonaPage({ lang }));
      expect(anchors(html)).toContainEqual({
        href: `${prefix}/book`,
        text: watanonaDict[lang].enrollBtn,
      });
    });

    it(`${lang}: footer FAQ shortcut resolves to the active homepage section`, () => {
      const footer = renderToStaticMarkup(createElement(SiteFooter, { lang }));
      const home = renderToStaticMarkup(createElement(FunHome, { lang }));
      expect(anchors(footer).some((link) => link.href === `${prefix || '/'}#faq`)).toBe(true);
      expect(home.match(/<section\b[^>]*\bid="faq"/g)).toHaveLength(1);
    });

    it(`${lang}: homepage cards render named program links and keep preview buttons`, () => {
      const html = renderToStaticMarkup(createElement(FunHome, { lang }));
      const links = anchors(html);
      for (const program of curriculumPrograms()) {
        expect(links).toContainEqual({
          href: `${prefix}/programs/${program.detailSlug}`,
          text: program.name,
        });
        expect(html).toContain(`data-testid="button-program-${program.id}"`);
      }
    });
  }
});
