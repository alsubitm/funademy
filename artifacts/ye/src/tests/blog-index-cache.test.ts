import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const mocks = vi.hoisted(() => ({
  cache: vi.fn((work: () => unknown, _keys: string[], _options: unknown) => work),
  revalidateTag: vi.fn(), revalidatePath: vi.fn(),
  findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn(),
}));
vi.mock('next/cache', () => ({
  unstable_cache: mocks.cache,
  revalidateTag: mocks.revalidateTag, revalidatePath: mocks.revalidatePath,
}));
vi.mock('@/lib/db', () => ({
  prisma: { blogPost: mocks },
  withDbRetry: (work: () => unknown) => work(),
}));
vi.mock('@/app/(ar)/svc/admin/guard', () => ({ requireAdmin: async () => null }));
import { BLOG_INDEX_TAG, getBlogIndex } from '@/lib/blog-index';
import { POST, PATCH, DELETE } from '@/app/(ar)/svc/admin/blog/route';

const post = { id: 1, slug: 'test', titleAr: 'عنوان', excerptAr: 'ملخص', contentAr: 'مقال' };
const request = (method: string, body: unknown) => new NextRequest('http://test.local/svc/admin/blog', {
  method, body: JSON.stringify(body),
});
beforeEach(() => {
  for (const mock of [mocks.findMany, mocks.findUnique, mocks.create, mocks.update,
    mocks.delete, mocks.revalidateTag, mocks.revalidatePath]) mock.mockReset();
});

describe('blog listing data cache', () => {
  it('caches summaries for five minutes and never fetches article bodies', async () => {
    mocks.findMany.mockResolvedValue([post]);
    await getBlogIndex();
    expect(mocks.cache).toHaveBeenCalledWith(expect.any(Function),
      expect.any(Array), { revalidate: 300, tags: [BLOG_INDEX_TAG] });
    expect(mocks.findMany).toHaveBeenCalledWith({
      where: { published: true },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true, slug: true, titleAr: true, titleEn: true,
        excerptAr: true, excerptEn: true, coverEmoji: true, publishedAt: true,
      },
    });
  });

  it('rejects failed queries rather than caching an empty successful result', async () => {
    mocks.findMany.mockRejectedValueOnce(new Error('offline'));
    await expect(getBlogIndex()).rejects.toThrow('offline');
  });

  it.each(['POST', 'PATCH', 'DELETE'])('invalidates both language listings after %s', async (method) => {
    mocks.findUnique.mockResolvedValue(method === 'POST' ? null : post);
    mocks.create.mockResolvedValue(post);
    mocks.update.mockResolvedValue(post);
    mocks.delete.mockResolvedValue(post);
    const response = method === 'POST'
      ? await POST(request(method, post))
      : method === 'PATCH'
        ? await PATCH(request(method, { id: 1, data: { published: false } }))
        : await DELETE(request(method, { id: 1 }));
    expect(response.status).toBe(method === 'POST' ? 201 : 200);
    expect(mocks.revalidateTag).toHaveBeenCalledWith(BLOG_INDEX_TAG);
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/blog');
    expect(mocks.revalidatePath).toHaveBeenCalledWith('/en/blog');
  });
});
