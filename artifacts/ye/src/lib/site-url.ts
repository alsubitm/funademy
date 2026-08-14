/**
 * Canonical site URL — the ONE place that decides which absolute domain
 * appears in canonicals, hreflang, Open Graph, JSON-LD, sitemap, robots,
 * and llms.txt.
 *
 * Always returns the canonical public domain (https://funademy.io).
 * NEVER derive this from REPLIT_DOMAINS: in the workspace (and during the
 * publish build) that variable holds the temporary dev domain, and at
 * deployment runtime it holds the .replit.app domain — both leaked into
 * production SEO tags before this was centralized.
 *
 * Override with the SITE_URL env var only if the canonical domain changes.
 */
const CANONICAL_URL = 'https://funademy.io';

export function siteUrl(): string {
  const override = process.env.SITE_URL?.trim().replace(/\/+$/, '');
  return override || CANONICAL_URL;
}
