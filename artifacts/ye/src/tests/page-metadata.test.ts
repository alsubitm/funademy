import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';
import type { Metadata } from 'next';
import { resolveTitle } from 'next/dist/lib/metadata/resolvers/resolve-title';
import { buildPageMetadata, buildSocialMetadata } from '@/lib/page-metadata';
import { ogImageUrl, siteUrl } from '@/lib/site-url';

const base = siteUrl();
const program = {
  nameAr: 'مهندسون صغار',
  nameEn: 'Young Engineers',
  taglineAr: 'تعلم الهندسة والبرمجة للأطفال',
  taglineEn: 'Engineering and coding for children',
  coverImageUrl: '/program-cover.jpg',
};
const post = {
  published: true,
  titleAr: 'تعليم الهندسة للأطفال',
  titleEn: 'Engineering for children',
  excerptAr: 'أنشطة ونصائح تعليمية للأهالي',
  excerptEn: 'Learning activities and tips for parents',
  coverImageUrl: 'https://images.example.com/article.jpg',
  publishedAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-02-01'),
};

/**
 * Evaluate the actual route metadata declarations without importing page UI,
 * font loaders or a database client. Only DB results are replaced by fixtures.
 * TypeScript's parser keeps this working with nested objects and async queries.
 */
async function routeMetadata(
  route: string,
  record: unknown = route.includes('/blog/') ? post : program,
): Promise<Metadata> {
  const file = join(process.cwd(), 'src/app', route);
  const source = readFileSync(file, 'utf8');
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const statements = ast.statements.filter((node) => {
    if (ts.isFunctionDeclaration(node)) return node.name?.text === 'generateMetadata';
    return ts.isVariableStatement(node) && node.declarationList.declarations.some((declaration) =>
      ts.isIdentifier(declaration.name) &&
      /^(metadata|SITE_URL|OG_IMAGE|_siteUrl|_.*Base)$/.test(declaration.name.text));
  });
  const code = ts.transpileModule(statements.map((node) => node.getText(ast)).join('\n'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports: {
    metadata?: Metadata;
    generateMetadata?: (props: { params: Promise<{ slug: string }> }) => Promise<Metadata>;
  } = {};
  const findUnique = async () => record;
  new Function(
    'exports', 'siteUrl', 'ogImageUrl', 'buildPageMetadata', 'buildSocialMetadata',
    'prisma', 'safeQuery', 'withDbRetry', 'getProgramDetail', code,
  )(
    exports, siteUrl, ogImageUrl, buildPageMetadata, buildSocialMetadata,
    { program: { findUnique }, blogPost: { findUnique } },
    async (query: () => Promise<unknown>) => query(),
    async (query: () => Promise<unknown>) => query(),
    findUnique,
  );
  return exports.generateMetadata
    ? exports.generateMetadata({ params: Promise.resolve({ slug: 'sample' }) })
    : exports.metadata!;
}

function expectSocialIdentity(metadata: Metadata, path: string, lang: 'ar' | 'en') {
  const og = metadata.openGraph!;
  const twitter = metadata.twitter!;
  expect(og.url).toBe(`${base}${path}`);
  expect(og.siteName).toBe('FunAdemy');
  expect(og.locale).toBe(lang === 'ar' ? 'ar_SA' : 'en_SA');
  expect(og.title).toBeTruthy();
  expect(og.description).toBeTruthy();
  expect(twitter.title).toBe(og.title);
  expect(twitter.description).toBe(og.description);
  expect(twitter).toMatchObject({ card: 'summary_large_image', site: '@funademy' });
  const images = og.images as { url: string; width: number; height: number; alt: string }[];
  expect(images.length).toBeGreaterThan(0);
  expect(images[0]).toMatchObject({ width: 1200, height: 630 });
  expect(images[0].alt).toBeTruthy();
  expect(twitter.images).toEqual(images.map((image) => image.url));
}

describe('public route metadata', () => {
  const pages = [
    '', 'help', 'programs', 'programs/[slug]', 'blog', 'blog/[slug]',
    'book', 'contact', 'enroll', 'consult', 'privacy', 'terms', 'watanona',
  ];
  for (const lang of ['ar', 'en'] as const) {
    const root = lang === 'ar' ? '(ar)' : 'en';
    for (const page of pages) {
      const path = (lang === 'en' ? '/en' : '') +
        (page ? `/${page.replace('[slug]', 'sample')}` : lang === 'ar' ? '/' : '');
      it(`${path} has complete social identity and one brand in its resolved title`, async () => {
        const metadata = await routeMetadata(`${root}/${page ? `${page}/` : ''}page.tsx`);
        const layout = await routeMetadata(`${root}/layout.tsx`);
        const template = (layout.title as { template: string }).template;
        const title = resolveTitle(metadata.title, template)!.absolute;
        expect(title.match(/FunAdemy/g)).toHaveLength(1);
        // Measure the result of Next's title template, not the child string.
        expect(title.length, `${path}: ${title} (${title.length} characters)`).toBeLessThanOrEqual(70);
        expectSocialIdentity(metadata, path, lang);
        if (page !== 'blog/[slug]') expect(metadata.openGraph).toHaveProperty('type', 'website');
      });
    }
    it(`${lang} article preserves its custom image, type and timestamps`, async () => {
      const metadata = await routeMetadata(`${root}/blog/[slug]/page.tsx`);
      expect(metadata.openGraph).toMatchObject({
        type: 'article',
        publishedTime: post.publishedAt.toISOString(),
        modifiedTime: post.updatedAt.toISOString(),
        images: [expect.objectContaining({ url: post.coverImageUrl })],
      });
    });
    it(`${lang} missing records and unpublished articles do not fabricate metadata`, async () => {
      expect(await routeMetadata(`${root}/programs/[slug]/page.tsx`, null)).toEqual({});
      expect(await routeMetadata(`${root}/blog/[slug]/page.tsx`, null)).toEqual({});
      expect(await routeMetadata(`${root}/blog/[slug]/page.tsx`, { ...post, published: false })).toEqual({});
    });
  }

  it('uses the Arabic program name and falls back for blank or missing translations', async () => {
    const route = '(ar)/programs/[slug]/page.tsx';
    const metadata = await routeMetadata(route);
    expect(metadata.title).toBe(`برنامج ${program.nameAr}`);
    expect(metadata.openGraph!.title).toBe(`برنامج ${program.nameAr} — FunAdemy`);
    for (const nameAr of [null, '', '   ']) {
      const fallback = await routeMetadata(route, { ...program, nameAr });
      expect(fallback.title).toBe(`برنامج ${program.nameEn}`);
      expect(fallback.twitter!.title).toBe(`برنامج ${program.nameEn} — FunAdemy`);
    }
  });

  it('English home social copy matches its current online-course search description', async () => {
    const metadata = await routeMetadata('en/page.tsx');
    expect(metadata.openGraph!.description).toBe(metadata.description);
    expect(metadata.twitter!.description).toContain('online');
    expect(metadata.twitter!.description).not.toContain('In-person');
  });
});

describe('shared social metadata builder', () => {
  it('creates complete defaults and preserves canonical alternates and absolute titles', () => {
    const input = {
      title: { absolute: 'FunAdemy | Help' },
      description: 'Help with programs and booking',
      alternates: { canonical: `${base}/help`, languages: { 'ar-SA': `${base}/help` } },
    };
    const metadata = buildPageMetadata(input, 'en');
    expect(metadata.title).toEqual(input.title);
    expect(metadata.alternates).toEqual(input.alternates);
    expectSocialIdentity(metadata, '/help', 'en');
  });

  it('does not let an old homepage identity override the current page', () => {
    const metadata = buildPageMetadata({
      title: 'Help',
      description: 'Booking help',
      alternates: { canonical: `${base}/en/help` },
      openGraph: {
        url: base,
        siteName: 'Old site',
        images: [{ url: 'https://preview.replit.dev/cover.jpg', alt: 'Help cover' }],
      },
      twitter: { title: 'Unrelated homepage', description: 'Old copy' },
    }, 'en');
    expectSocialIdentity(metadata, '/en/help', 'en');
    expect(metadata.openGraph!.images).toEqual([
      expect.objectContaining({ url: `${base}/og-default.jpg`, alt: 'Help cover' }),
    ]);
  });
});
