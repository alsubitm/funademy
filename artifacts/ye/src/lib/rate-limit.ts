/**
 * Durable sliding-window rate limiter for public booking endpoints.
 * Counters are persisted in the database (ye_rate_limit_hits) so limits
 * survive server restarts and apply across multiple instances — an
 * in-memory Map would reset to zero on every deploy, letting a script
 * create unlimited real Google Calendar events.
 *
 * Not a substitute for a WAF, but stops casual scripted abuse of routes
 * that trigger real Google Calendar events and emails.
 */
import { prisma, withDbRetry } from '@/lib/db';

/**
 * Returns true when the caller is within `max` hits per `windowMs`.
 * A Postgres advisory transaction lock on the key serializes concurrent
 * checks, making the count-then-insert an atomic quota claim: parallel
 * requests for the same key queue on the lock instead of all observing
 * the same stale count. Fails closed: if the database is unavailable the
 * request is rejected, since every accepted request can create a real
 * calendar event.
 */
export async function allowRate(key: string, max: number, windowMs: number): Promise<boolean> {
  const now = new Date();
  const cutoff = new Date(now.getTime() - windowMs);
  try {
    return await withDbRetry(() => prisma.$transaction(async (tx) => {
      // Per-key mutex, auto-released at transaction end.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      const hits = await tx.rateLimitHit.count({ where: { key, at: { gt: cutoff } } });
      if (hits >= max) return false;
      await tx.rateLimitHit.create({ data: { key, at: now } });
      return true;
    }), { operation: 'rate-limit-claim', kind: 'transaction' });
  } catch (e) {
    console.error('[rate-limit] check failed, rejecting request:', e);
    return false;
  } finally {
    // Opportunistic cleanup so the table cannot grow unbounded. Anything
    // older than the largest window we use (24h) is dead weight.
    const stale = new Date(now.getTime() - 24 * 60 * 60_000);
    prisma.rateLimitHit
      .deleteMany({ where: { at: { lt: stale } } })
      .catch(() => {});
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get('x-forwarded-for');
  return fwd ? fwd.split(',')[0].trim() : 'unknown';
}
