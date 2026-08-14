/**
 * Guard: per-record OG images (blog/program coverImageUrl) must never leak
 * a dev/preview host into production metadata.
 *
 * All stored cover values pass through ogImageUrl(), which keeps real
 * https URLs, resolves relative paths against the canonical domain, and
 * falls back to the default OG image for anything unsafe (replit or
 * localhost hosts, plain http, malformed values).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ogImageUrl, siteUrl } from '@/lib/site-url';

const CANON = siteUrl();
const FALLBACK = `${CANON}/og-default.jpg`;

describe('ogImageUrl()', () => {
  it('falls back to the default OG image when empty', () => {
    expect(ogImageUrl(null)).toBe(FALLBACK);
    expect(ogImageUrl(undefined)).toBe(FALLBACK);
    expect(ogImageUrl('   ')).toBe(FALLBACK);
  });

  it('keeps real https URLs as-is', () => {
    expect(ogImageUrl('https://images.example.com/cover.jpg')).toBe(
      'https://images.example.com/cover.jpg'
    );
  });

  it('serves relative paths from the canonical domain', () => {
    expect(ogImageUrl('/uploads/cover.jpg')).toBe(`${CANON}/uploads/cover.jpg`);
  });

  it('never emits dev/preview or local hosts', () => {
    const bad = [
      'https://abc-123.picard.replit.dev/cover.jpg',
      'https://learning-hub-x.replit.app/cover.jpg',
      'https://foo.repl.co/x.png',
      'https://replit.dev/x.png',
      'https://replit.app/x.png',
      'https://localhost/x.png',
      'https://localhost:3000/x.png',
      'https://127.0.0.1/x.png',
      'https://0.0.0.0:5000/x.png',
      'https://[::1]/x.png',
      'http://images.example.com/cover.jpg', // non-https
      '//evil.example.com/x.png', // protocol-relative
      'not a url',
    ];
    for (const value of bad) {
      expect(ogImageUrl(value), value).toBe(FALLBACK);
    }
  });
});

describe('metadata pages route stored cover images through ogImageUrl', () => {
  const pages = [
    'src/app/(ar)/blog/[slug]/page.tsx',
    'src/app/en/blog/[slug]/page.tsx',
    'src/app/(ar)/programs/[slug]/page.tsx',
    'src/app/en/programs/[slug]/page.tsx',
  ];
  for (const rel of pages) {
    it(rel, () => {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      expect(src, `${rel} must sanitize coverImageUrl via ogImageUrl()`).toMatch(/ogImageUrl\(/);
      expect(src, `${rel} must not use raw coverImageUrl for OG images`).not.toMatch(
        /coverImageUrl\s*\?\?/
      );
    });
  }
});

describe('root layouts declare metadataBase as a defensive invariant', () => {
  for (const rel of ['src/app/(ar)/layout.tsx', 'src/app/en/layout.tsx']) {
    it(rel, () => {
      const src = readFileSync(join(process.cwd(), rel), 'utf8');
      expect(src).toMatch(/metadataBase:\s*new URL\(/);
    });
  }
});
