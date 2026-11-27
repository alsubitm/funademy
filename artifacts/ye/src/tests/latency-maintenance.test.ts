import { beforeEach, describe, expect, it, vi } from 'vitest';
const db = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock('@/lib/db', () => ({ prisma: { $executeRaw: db.execute } }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { revalidatePath } from 'next/cache';
import { revalidatePrograms } from '@/lib/revalidate-programs';
import { purgeExpiredChat } from '@/lib/chat-retention';

beforeEach(() => vi.resetAllMocks());
describe('bounded maintenance and cache invalidation', () => {
  it('purges one table at a time using five bounded statements, with no select-then-delete scans', async () => {
    let active = 0;
    let peak = 0;
    db.execute.mockImplementation(async () => {
      peak = Math.max(peak, ++active);
      await Promise.resolve();
      active--;
      return 1;
    });
    expect(await purgeExpiredChat(10)).toEqual({ purged: 5 });
    expect(peak).toBe(1);
    expect(db.execute).toHaveBeenCalledTimes(5);
    for (const [sql, , , limit] of db.execute.mock.calls) {
      expect(sql.join('')).toContain('FOR UPDATE SKIP LOCKED');
      expect(sql.join('')).toContain('LIMIT');
      expect(limit).toBe(10);
    }
  });
  it('invalidates both program locales and booking/pricing pages', () => {
    revalidatePrograms();
    expect(revalidatePath).toHaveBeenCalledWith('/programs/[slug]', 'page');
    expect(revalidatePath).toHaveBeenCalledWith('/en/programs/[slug]', 'page');
    expect(revalidatePath).toHaveBeenCalledWith('/book');
    expect(revalidatePath).toHaveBeenCalledWith('/en/enroll');
  });
});
