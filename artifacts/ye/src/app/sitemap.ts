import type { MetadataRoute } from 'next';
import { prisma } from '@/lib/db';

const PROGRAM_SLUGS = [
  'big-builders',
  'smartivo',
  'bricks-challenge',
  'algoplay-robotoys',
  'galileo-technic',
  'algoc',
];

function baseUrl(): string {
  // In production the platform serves the site at the deployed domain root.
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
  return domain ? `https://${domain}` : 'http://localhost';
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = baseUrl();
  const now = new Date();
  const blogSlugs = await prisma.blogPost
    .findMany({ where: { published: true }, select: { slug: true } })
    .then((posts) => posts.map((p) => p.slug))
    .catch(() => [] as string[]);
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
    ...PROGRAM_SLUGS.flatMap((s) => [`/programs/${s}`, `/en/programs/${s}`]),
    ...blogSlugs.flatMap((s) => [`/blog/${s}`, `/en/blog/${s}`]),
  ];
  return paths.map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: p === '/' ? 'weekly' : 'monthly',
    priority: p === '/' ? 1 : p.startsWith('/en') ? 0.6 : 0.8,
  }));
}
