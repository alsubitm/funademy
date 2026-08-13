import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/svc/', '/portal', '/en/portal', '/account', '/en/account', '/learn'] }],
    sitemap: domain ? `https://${domain}/sitemap.xml` : undefined,
  };
}
