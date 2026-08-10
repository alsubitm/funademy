/**
 * Canonical site URL — derived from the deployed domain at runtime,
 * falling back to localhost for local dev. Shared across sitemap, JSON-LD, etc.
 */
export function siteUrl(): string {
  const domain = process.env.REPLIT_DOMAINS?.split(',')[0];
  return domain ? `https://${domain}` : 'http://localhost';
}
