import { beforeEach, describe, expect, it, vi } from 'vitest';

const db = vi.hoisted(() => ({
  $transaction: vi.fn(), $queryRaw: vi.fn(), $executeRaw: vi.fn(),
}));
vi.mock('@/lib/db', () => ({ prisma: db }));
import { sweepAbuseRetention } from '@/lib/abuse-retention';

beforeEach(() => {
  vi.resetAllMocks();
  db.$queryRaw.mockResolvedValue([{ acquired: true }]);
  db.$transaction.mockImplementation(async (work) => work(db));
});

describe('independently committed retention batches', () => {
  it('finishes each limited batch before starting the next transaction', async () => {
    db.$executeRaw
      .mockResolvedValueOnce(5000).mockResolvedValueOnce(1)
      .mockResolvedValue(0);
    await sweepAbuseRetention(new Date('2026-11-27T12:00:00Z'));
    expect(db.$transaction).toHaveBeenCalledTimes(6);
    expect(db.$queryRaw).toHaveBeenCalledTimes(6);
    expect(db.$executeRaw.mock.calls[0][0].sql).toContain('DELETE FROM ye_rate_limit_windows');
    for (const [query] of db.$executeRaw.mock.calls) {
      expect(query.sql).toContain('LIMIT');
      expect(query.values).toContain(5000);
    }
    for (const [, options] of db.$transaction.mock.calls) {
      expect(options).toEqual({ maxWait: 10_000, timeout: 60_000 });
    }
  });

  it('skips deletes when another worker owns the transaction lock', async () => {
    db.$queryRaw.mockResolvedValue([{ acquired: false }]);
    await sweepAbuseRetention();
    expect(db.$executeRaw).not.toHaveBeenCalled();
  });

  it('surfaces a failed later batch without enclosing earlier batches in a rollback', async () => {
    db.$executeRaw.mockResolvedValueOnce(5000).mockRejectedValueOnce(new Error('connection lost'));
    await expect(sweepAbuseRetention()).rejects.toThrow('connection lost');
    expect(db.$transaction).toHaveBeenCalledTimes(2);
    db.$executeRaw.mockReset().mockResolvedValue(0);
    await sweepAbuseRetention();
    expect(db.$transaction).toHaveBeenCalledTimes(6);
  });
});
