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

/**
 * Normalize a persisted image URL (e.g. blog/program coverImageUrl) before
 * it is emitted in Open Graph / Twitter metadata. Stored values are
 * unrestricted, so legacy rows could contain a temporary dev-host URL that
 * must never reach production HTML.
 *
 * - empty / null / undefined     → canonical default OG image
 * - "/path" (relative)           → served from the canonical domain
 * - https:// on a real host      → kept as-is
 * - anything else (http:, replit.dev / replit.app / repl.co, localhost,
 *   bare IPs, malformed values)  → canonical default OG image
 */
const BLOCKED_HOST_SUFFIXES = ['.replit.dev', '.replit.app', '.repl.co'];

export function ogImageUrl(stored: string | null | undefined): string {
  const fallback = `${siteUrl()}/og-default.jpg`;
  const value = stored?.trim();
  if (!value) return fallback;
  if (value.startsWith('/') && !value.startsWith('//')) return `${siteUrl()}${value}`;

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return fallback;
  }
  if (parsed.protocol !== 'https:') return fallback;

  const host = parsed.hostname.toLowerCase();
  const blocked =
    host === 'localhost' ||
    host.includes(':') || // IPv6 literals
    /^\d+\.\d+\.\d+\.\d+$/.test(host) || // bare IPv4 (incl. 127.x, 0.0.0.0)
    BLOCKED_HOST_SUFFIXES.some((s) => host === s.slice(1) || host.endsWith(s));
  return blocked ? fallback : value;
}
