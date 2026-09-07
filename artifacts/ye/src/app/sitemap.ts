import type { MetadataRoute } from 'next';
import { prisma, withDbRetry } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';
import { safeQuery } from '@/lib/safe-query';

// Evaluate at request time (with the production env + database), never at
// build time: the publish build runs in the workspace env, which would bake
// dev-database slugs into the deployed sitemap.
export const dynamic = 'force-dynamic';

/** Fallback only — the live list comes from the Program table. */
const PROGRAM_SLUGS_FALLBACK = [
  'big-builders',
  'smartivo',
  'bricks-challenge',
  'algoplay-robotoys',
  'galileo-technic',
  'algoc',
];

// Representative last-edited dates for genuinely static pages.
const STATIC_DATES: Record<string, Date> = {
  '/': new Date('2025-01-01'),
  '/en': new Date('2025-01-01'),
  '/watanona': new Date('2025-01-01'),
  '/en/watanona': new Date('2025-01-01'),
  '/book': new Date('2025-03-01'),
  '/en/book': new Date('2025-03-01'),
  '/contact': new Date('2025-01-01'),
  '/en/contact': new Date('2025-01-01'),
  '/blog': new Date('2025-01-01'),
  '/en/blog': new Date('2025-01-01'),
  '/enroll': new Date('2025-03-01'),
  '/en/enroll': new Date('2025-03-01'),
  '/consult': new Date('2025-01-01'),
  '/en/consult': new Date('2025-01-01'),
  '/privacy': new Date('2024-06-01'),
  '/en/privacy': new Date('2024-06-01'),
  '/terms': new Date('2024-06-01'),
  '/en/terms': new Date('2024-06-01'),
  '/nelc': new Date('2025-01-01'),
  '/en/nelc': new Date('2025-01-01'),
};

function priority(p: string): number {
  if (p === '/') return 1.0;
  if (p === '/en') return 0.9;
  if (p.startsWith('/en')) return 0.6;
  return 0.8;
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();

  const blogPosts = await safeQuery(
    () => withDbRetry(
      () => prisma.blogPost.findMany({
        where: { published: true },
        select: { slug: true, updatedAt: true },
      }),
      { operation: 'sitemap:blog-posts', kind: 'read' },
    ),
    [] as { slug: string; updatedAt: Date }[],
    'sitemap:blog-posts',
  );

  const programs = await safeQuery(
    () => withDbRetry(
      () => prisma.program.findMany({ select: { slug: true }, orderBy: { position: 'asc' } }),
      { operation: 'sitemap:programs', kind: 'read' },
    ),
    PROGRAM_SLUGS_FALLBACK.map((slug) => ({ slug })),
    'sitemap:programs',
  );

  const staticEntries: MetadataRoute.Sitemap = Object.entries(STATIC_DATES).map(
    ([p, lastModified]) => ({
      url: `${base}${p}`,
      lastModified,
      changeFrequency: p === '/' || p === '/en' ? 'weekly' : 'monthly',
      priority: priority(p),
    }),
  );

  const programLastMod = new Date('2025-01-01');
  const programEntries: MetadataRoute.Sitemap = programs.flatMap(({ slug }) => [
    {
      url: `${base}/programs/${slug}`,
      lastModified: programLastMod,
      changeFrequency: 'monthly' as const,
      priority: priority(`/programs/${slug}`),
    },
    {
      url: `${base}/en/programs/${slug}`,
      lastModified: programLastMod,
      changeFrequency: 'monthly' as const,
      priority: priority(`/en/programs/${slug}`),
    },
  ]);

  const blogEntries: MetadataRoute.Sitemap = blogPosts.flatMap(({ slug, updatedAt }) => [
    {
      url: `${base}/blog/${slug}`,
      lastModified: updatedAt,
      changeFrequency: 'monthly' as const,
      priority: priority(`/blog/${slug}`),
    },
    {
      url: `${base}/en/blog/${slug}`,
      lastModified: updatedAt,
      changeFrequency: 'monthly' as const,
      priority: priority(`/en/blog/${slug}`),
    },
  ]);

  return [...staticEntries, ...programEntries, ...blogEntries];
}
