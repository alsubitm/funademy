import { expect, it, vi } from 'vitest';
import { prisma } from '@/lib/db';
import { allowRate } from '@/lib/rate-limit';
import { sweepAbuseRetention } from '@/lib/abuse-retention';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

it('keeps a renewed quota when retention took its snapshot before the writer committed', async () => {
  const key = `retention-race:${Date.now()}`;
  await prisma.rateLimitWindow.create({ data: {
    key, hits: [new Date(0)], expiresAt: new Date(0),
  } });
  const renewed = deferred<number>();
  const release = deferred<void>();
  // Run the actual allowRate SQL on a real transaction connection. Hold its
  // commit so retention sees the old expired row and must wait for renewal.
  // Only connection routing is intercepted; PostgreSQL executes the real claim.
  const writer = prisma.$transaction(async tx => {
    const [backend] = await tx.$queryRaw<{ pid: number }[]>`SELECT pg_backend_pid() AS pid`;
    const query = vi.spyOn(prisma, '$queryRaw').mockImplementationOnce(
      ((...args: Parameters<typeof prisma.$queryRaw>) => tx.$queryRaw(...args)) as typeof prisma.$queryRaw,
    );
    try {
      expect(await allowRate(key, 2, 60_000)).toBe(true);
    } finally {
      query.mockRestore();
    }
    renewed.resolve(backend.pid);
    await release.promise;
  }, { timeout: 20_000 });
  let cleanup: Promise<void> | undefined;
  try {
    const writerPid = await renewed.promise;
    cleanup = sweepAbuseRetention();
    // This proves the DELETE has selected the expired row and is waiting on
    // this specific writer, rather than relying on sleeps or test timing.
    await vi.waitFor(async () => {
      const [waiting] = await prisma.$queryRawUnsafe<{ n: bigint }[]>(`
        SELECT count(*) AS n FROM pg_stat_activity
        WHERE datname = current_database()
          AND $1::int = ANY(pg_blocking_pids(pid))
          AND query LIKE '%DELETE FROM ye_rate_limit_windows%'
      `, writerPid);
      expect(Number(waiting.n)).toBeGreaterThan(0);
    }, { timeout: 10_000, interval: 25 });
    release.resolve();
    await writer;
    await cleanup;
    const window = await prisma.rateLimitWindow.findUniqueOrThrow({ where: { key } });
    expect(window.hits).toHaveLength(1);
    expect(window.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(await allowRate(key, 2, 60_000)).toBe(true);
    expect(await allowRate(key, 2, 60_000)).toBe(false);
    expect((await prisma.rateLimitWindow.findUniqueOrThrow({ where: { key } })).hits).toHaveLength(2);
  } finally {
    release.resolve();
    await writer;
    await cleanup;
    await prisma.rateLimitWindow.deleteMany({ where: { key } });
  }
});
