import { existsSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({
  prisma: {
    blogPost: { findMany: vi.fn(async () => []) },
    program: { findMany: vi.fn(async () => []) },
  },
  withDbRetry: (query: () => Promise<unknown>) => query(),
}));

import sitemap from '@/app/sitemap';
import { siteUrl } from '@/lib/site-url';

describe('public crawlability', () => {
  it('lists both help pages exactly once and omits redirects and internal documentation', async () => {
    const entries = await sitemap();
    const urls = entries.map(({ url }) => url);

    for (const route of ['/help', '/en/help']) {
      expect(urls.filter((url) => url === `${siteUrl()}${route}`)).toHaveLength(1);
    }
    for (const route of ['/nelc', '/en/nelc', '/funademy-updates.html']) {
      expect(urls).not.toContain(`${siteUrl()}${route}`);
    }
  });

  it('keeps the internal design handoff outside the deployed public directory', () => {
    const document = path.resolve(__dirname, '../../public/funademy-updates.html');
    expect(existsSync(document)).toBe(false);
  });
});
