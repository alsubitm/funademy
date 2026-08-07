import type { MetadataRoute } from 'next';

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

export default function sitemap(): MetadataRoute.Sitemap {
  const base = baseUrl();
  const now = new Date();
  const paths = [
    '/',
    '/en',
    '/watanona',
    '/en/watanona',
    '/book',
    '/en/book',
    '/contact',
    '/en/contact',
    ...PROGRAM_SLUGS.flatMap((s) => [`/programs/${s}`, `/en/programs/${s}`]),
  ];
  return paths.map((p) => ({
    url: `${base}${p}`,
    lastModified: now,
    changeFrequency: p === '/' ? 'weekly' : 'monthly',
    priority: p === '/' ? 1 : p.startsWith('/en') ? 0.6 : 0.8,
  }));
}
