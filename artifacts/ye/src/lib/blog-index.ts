import { unstable_cache } from 'next/cache';
import { prisma, withDbRetry } from '@/lib/db';

export const BLOG_INDEX_TAG = 'blog-index';

// Cache data rather than statically rendering the page: /blog is a static
// segment, so revalidate=300 alone WOULD execute its DB query during build.
// Keep failures outside the cache (the page owns the unavailable state).
export const getBlogIndex = unstable_cache(
  () => withDbRetry(
    () => prisma.blogPost.findMany({
      where: { published: true },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, slug: true, titleAr: true, titleEn: true,
        excerptAr: true, excerptEn: true, coverEmoji: true, publishedAt: true,
      },
    }),
    { operation: 'blog:index', kind: 'read' },
  ),
  ['blog-index-summaries-v1'],
  { revalidate: 300, tags: [BLOG_INDEX_TAG] },
);
