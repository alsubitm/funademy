import { prisma } from '@/lib/db';
import { riyadhDay } from '@/lib/constants';

/** Scheduled maintenance only: never invoke from a public request.
 * A transaction try-lock avoids overlapping workers across server instances. */
export async function sweepAbuseRetention(now = new Date()) {
  return prisma.$transaction(async (tx) => {
    const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
      SELECT pg_try_advisory_xact_lock(hashtext('abuse-retention')) AS acquired`;
    if (!lock.acquired) return;
    // Click quotas have one-minute windows. Do not retain their hit rows for a day.
    await tx.rateLimitHit.deleteMany({
      where: { key: { startsWith: 'clicks:' }, at: { lt: new Date(now.getTime() - 60_000) } },
    });
    await tx.rateLimitHit.deleteMany({
      where: { at: { lt: new Date(now.getTime() - 86400_000) } },
    });
    await tx.clickEvent.deleteMany({
      where: { day: { lt: riyadhDay(new Date(now.getTime() - 90 * 86400_000)) } },
    });
  });
}
