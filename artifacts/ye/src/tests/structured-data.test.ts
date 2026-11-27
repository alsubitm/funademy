import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { siteUrl } from '@/lib/site-url';

const db = vi.hoisted(() => ({
  programs: vi.fn(),
  post: vi.fn(),
  relatedPosts: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  prisma: {
    program: { findMany: db.programs },
    blogPost: { findUnique: db.post, findMany: db.relatedPosts },
  },
  withDbRetry: (query: () => unknown) => query(),
}));
vi.mock('@/lib/safe-query', () => ({
  safeQuery: (query: () => unknown) => query(),
}));
vi.mock('@/components/SiteHeader', () => ({ SiteHeader: () => null }));
vi.mock('@/components/SiteFooter', () => ({ SiteFooter: () => null }));
vi.mock('@/components/WhatsAppFloat', () => ({ WhatsAppFloat: () => null }));
vi.mock('@/components/blog/BlogArticle', () => ({
  BlogArticle: () => null,
  BlogArticleUnavailable: () => null,
}));

import ArabicPrograms from '@/app/(ar)/programs/page';
import EnglishPrograms from '@/app/en/programs/page';
import ArabicArticle from '@/app/(ar)/blog/[slug]/page';
import EnglishArticle from '@/app/en/blog/[slug]/page';
import { ProgramsListing } from '@/components/ProgramsListing';

function program(slug: string, id: number, nameEn = slug) {
  return {
    id, slug, nameEn, nameAr: `عربي ${slug}`, kitCode: 'TEST',
    ageMin: 4, ageMax: 8, format: 'Online', color: '#123456',
    level: 1, taglineEn: 'Learn', taglineAr: 'تعلم',
  };
}

function schemas(html: string) {
  return [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map((match) => JSON.parse(match[1]));
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each([
  { lang: 'ar' as const, prefix: '', page: ArabicPrograms },
  { lang: 'en' as const, prefix: '/en', page: EnglishPrograms },
])('$lang catalog structured data', ({ lang, prefix, page }) => {
  it('server-renders only visible courses in grouped card order with canonical detail identifiers', async () => {
    const programs = [
      program('smartivo', 1, 'Smartivo'),
      program('unknown-course', 2),
      program('galileo-technic', 3, 'Galileo Technic'),
      program('big-builders', 4, 'Big Builders'),
      program('bricks-challenge', 5, 'Bricks Challenge'),
    ];
    db.programs.mockResolvedValue(programs);
    const html = renderToStaticMarkup(await page());
    const [list] = schemas(html);
    expect(schemas(html)).toHaveLength(1);
    expect(list['@context']).toBe('https://schema.org');
    expect(list['@type']).toBe('ItemList');
    expect(list.url).toBe(`${siteUrl()}${prefix}/programs`);
    expect(list.numberOfItems).toBe(4);
    expect(list.itemListOrder).toBe('https://schema.org/ItemListOrderAscending');
    const ordered = [programs[3], programs[2], programs[4], programs[0]];
    expect(list.itemListElement).toEqual(ordered.map((course, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'Course',
        '@id': `${siteUrl()}${prefix}/programs/${course.slug}`,
        url: `${siteUrl()}${prefix}/programs/${course.slug}`,
        name: course.nameEn,
      },
    })));
    const cardLinks = [...html.matchAll(/href="([^"]+)">(?:تفاصيل البرنامج|Learn more)<\/a>/g)]
      .map((match) => `${siteUrl()}${match[1]}`);
    expect(list.itemListElement.map((entry: { item: { url: string } }) => entry.item.url))
      .toEqual(cardLinks);
    expect(html).not.toContain('unknown-course');
  });

  it.each([
    { programs: [] },
    { programs: [program('unknown-course', 1)] },
  ])('omits the list when no courses are visible ($programs)', async ({ programs }) => {
    db.programs.mockResolvedValue(programs);
    expect(schemas(renderToStaticMarkup(await page()))).toEqual([]);
  });

  it('safely serializes course names containing HTML', () => {
    const name = '</script><script>alert("test")</script>';
    const html = renderToStaticMarkup(createElement(ProgramsListing, {
      programs: [program('big-builders', 1, name)], lang,
    }));
    expect(schemas(html)[0].itemListElement[0].item.name).toBe(name);
    expect(html).not.toContain(name);
  });
});

describe.each([
  { lang: 'ar', page: ArabicArticle },
  { lang: 'en', page: EnglishArticle },
])('$lang article authorship', ({ page }) => {
  it('retains the genuine organization author without a synthetic person', async () => {
    const date = new Date('2026-11-01T00:00:00Z');
    db.post.mockResolvedValue({
      slug: 'test-article', published: true, titleAr: 'مقال', titleEn: 'Article',
      excerptAr: 'ملخص', excerptEn: 'Summary', coverImageUrl: null,
      publishedAt: date, createdAt: date, updatedAt: date,
    });
    db.relatedPosts.mockResolvedValue([]);
    const html = renderToStaticMarkup(await page({ params: Promise.resolve({ slug: 'test-article' }) }));
    const [schema] = schemas(html);
    const article = schema['@graph'].find((node: { '@type': string }) => node['@type'] === 'BlogPosting');
    expect(article.author).toEqual([{
      '@type': 'Organization', '@id': `${siteUrl()}/#organization`, name: 'FunAdemy',
    }]);
    expect(article.publisher['@type']).toBe('Organization');
    expect(html).not.toContain('"Person"');
  });
});
