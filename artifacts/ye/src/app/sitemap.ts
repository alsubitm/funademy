import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';
import { siteUrl } from '@/lib/site-url';

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

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();
  const blogSlugs = await prisma.blogPost
    .findMany({ where: { published: true }, select: { slug: true } })
    .then((posts) => posts.map((p) => p.slug))
    .catch(() => [] as string[]);
  const programSlugs = await prisma.program
    .findMany({ select: { slug: true }, orderBy: { position: 'asc' } })
    .then((programs) => programs.map((p) => p.slug))
    .catch(() => PROGRAM_SLUGS_FALLBACK);
  const paths = [
    '/',
    '/en',
    '/watanona',
    '/en/watanona',
    '/book',
    '/en/book',
    '/contact',
    '/en/contact',
    '/blog',
    '/en/blog',
    '/enroll',
    '/en/enroll',
    '/consult',
    '/en/consult',
    '/privacy',
    '/en/privacy',
    '/terms',
    '/en/terms',
    '/nelc',
    '/en/nelc',
    ...programSlugs.flatMap((s) => [`/programs/${s}`, `/en/programs/${s}`]),
    ...blogSlugs.flatMap((s) => [`/blog/${s}`, `/en/blog/${s}`]),
  ];
  return paths.map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: p === '/' ? 'weekly' : 'monthly',
    priority: p === '/' ? 1 : p.startsWith('/en') ? 0.6 : 0.8,
  }));
}
