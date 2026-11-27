import { prisma, withDbRetry } from '@/lib/db';

/**
 * Atomic sliding-window claim in one DB round trip. PostgreSQL's ON CONFLICT
 * row lock re-evaluates the array against the latest committed row, unlike a
 * count CTE after an advisory lock (which can use a stale statement snapshot).
 * Storage is bounded by max timestamps per key, not a growing row per hit.
 * Old hit rows seed new windows during the rollout so live quotas do not reset.
 */
export async function allowRate(key: string, max: number, windowMs: number): Promise<boolean> {
  if (!Number.isInteger(max) || max < 1 || !Number.isFinite(windowMs) || windowMs < 1) return false;
  try {
    const rows = await withDbRetry(() => prisma.$queryRaw<{ key: string }[]>`
      INSERT INTO ye_rate_limit_windows AS w (key, hits, "expiresAt")
      SELECT ${key}, seed.hits || ARRAY[statement_timestamp()::timestamp],
        statement_timestamp() + ${windowMs} * INTERVAL '1 millisecond'
      FROM (SELECT ARRAY(
        SELECT at FROM ye_rate_limit_hits
        WHERE key = ${key} AND at > statement_timestamp() - ${windowMs} * INTERVAL '1 millisecond'
        ORDER BY at DESC LIMIT ${max}
      ) AS hits) seed
      WHERE cardinality(seed.hits) < ${max}
      ON CONFLICT (key) DO UPDATE SET
        hits = ARRAY(SELECT h FROM unnest(w.hits) h
          WHERE h > statement_timestamp() - ${windowMs} * INTERVAL '1 millisecond')
          || ARRAY[statement_timestamp()::timestamp],
        "expiresAt" = statement_timestamp() + ${windowMs} * INTERVAL '1 millisecond'
      WHERE cardinality(ARRAY(SELECT h FROM unnest(w.hits) h
        WHERE h > statement_timestamp() - ${windowMs} * INTERVAL '1 millisecond')) < ${max}
      RETURNING key
    `, { operation: 'rate-limit-claim', kind: 'transaction' });
    return rows.length === 1;
  } catch (e) {
    console.error('[rate-limit] check failed, rejecting request:', e);
    return false;
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : 'unknown';
}
