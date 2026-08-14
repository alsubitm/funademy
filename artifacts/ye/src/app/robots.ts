import type { MetadataRoute } from 'next';
import { siteUrl } from '@/lib/site-url';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/svc/', '/portal', '/en/portal', '/account', '/en/account', '/learn'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
  };
}
