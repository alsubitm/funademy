import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { riyadhDay } from '@/lib/constants';

const BATCH_SIZE = 5000;

/** Each batch commits independently. Never hold a pooled session-level lock:
 * the next Prisma query may use a different connection (or a Neon pooler).
 * The tiny transaction lock serializes batches across server instances. */
async function drainBatch(query: Prisma.Sql) {
  for (;;) {
    const deleted = await prisma.$transaction(async (tx) => {
      const [lock] = await tx.$queryRaw<{ acquired: boolean }[]>`
        SELECT pg_try_advisory_xact_lock(hashtext('abuse-retention')) AS acquired`;
      if (!lock.acquired) return 0;
      return tx.$executeRaw(query);
    }, { maxWait: 10_000, timeout: 60_000 });
    if (deleted === 0) return;
  }
}

/** Scheduled maintenance only: never invoke from a public request. */
export async function sweepAbuseRetention(now = new Date()) {
  await drainBatch(Prisma.sql`
    DELETE FROM ye_rate_limit_hits WHERE id IN (
      SELECT id FROM ye_rate_limit_hits
      -- Pattern operators match the text_pattern_ops index regardless of
      -- database collation; ordinary >= / < can omit rows in ICU locales.
      WHERE key ~>=~ 'clicks:' AND key ~<~ 'clicks;'
        AND at < ${new Date(now.getTime() - 60_000)}
      LIMIT ${BATCH_SIZE}
    )`);
  await drainBatch(Prisma.sql`
    DELETE FROM ye_rate_limit_hits WHERE id IN (
      SELECT id FROM ye_rate_limit_hits
      WHERE at < ${new Date(now.getTime() - 86400_000)}
      LIMIT ${BATCH_SIZE}
    )`);
  await drainBatch(Prisma.sql`
    DELETE FROM ye_click_events WHERE id IN (
      SELECT id FROM ye_click_events
      WHERE day < ${riyadhDay(new Date(now.getTime() - 90 * 86400_000))}
      LIMIT ${BATCH_SIZE}
    )`);
}
