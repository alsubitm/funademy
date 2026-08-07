import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/svc/'] }],
    sitemap: domain ? `https://${domain}/sitemap.xml` : undefined,
  };
}
