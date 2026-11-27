/**
 * Next.js instrumentation — runs once when the server process starts.
 *
 * Starts a periodic in-process sweep of stale `initiated` payments so that
 * seats held by abandoned checkouts are released even during quiet periods
 * with no site traffic. (Checkout also sweeps opportunistically, and
 * POST /svc/pay/sweep remains available for external cron pingers.)
 */

const SWEEP_INTERVAL_MS = 10 * 60_000; // every 10 minutes
const INITIAL_DELAY_MS = 60_000; // let the server settle before first sweep

declare global {
  // eslint-disable-next-line no-var
  var __yeSweepTimer: NodeJS.Timeout | undefined;
}

export async function register() {
  // Only in the Node.js server runtime — never in edge/browser bundles,
  // never during `next build`, never inside the vitest suite.
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;
  if (process.env.VITEST) return;

  // Guard against duplicate timers on dev-server hot reloads.
  if (globalThis.__yeSweepTimer) return;

  // One-time legacy cutover (Aug 2026): if this database still keeps its data
  // in the old dedicated "ye" schema (production, before its first publish of
  // the public-schema build), move everything into public BEFORE any feature
  // code touches the DB. Instant no-op afterwards.
  //
  // FAIL-CLOSED: once legacy data is positively detected, a failed or aborted
  // cutover must NOT let the server come up — the new Prisma client only sees
  // the public schema, so serving would show families an empty site while the
  // real data sits invisible in "ye". A refused boot is visible (deploy fails,
  // previous release keeps running) and recoverable; silent empty data is not.
  {
    const { prisma } = await import('@/lib/db');
    const { hasLegacyYeSchema, migrateYeSchemaToPublic } = await import('@/lib/migrate-ye-schema');
    let legacy = false;
    try {
      legacy = await hasLegacyYeSchema(prisma);
    } catch (e) {
      // Probe failed — DB unreachable. Nothing data-destructive at stake yet;
      // keep the long-standing boot behavior for DB outages (pages error
      // visibly, static pages still serve) instead of crash-looping the site.
      console.error('[legacy-schema-migration] could not probe for legacy "ye" schema (DB unreachable?):', e);
    }
    if (legacy) {
      const res = await migrateYeSchemaToPublic(prisma); // unexpected errors propagate → boot fails
      if ('aborted' in res && res.aborted) {
        const detail =
          `conflicts (rows on both sides): [${res.conflicts.join(', ')}]; ` +
          `orphans with rows: [${res.orphansWithRows.join(', ')}]`;
        console.error(`[legacy-schema-migration] FATAL: cutover aborted — ${detail}. Refusing to start.`);
        throw new Error(
          `[legacy-schema-migration] one-time ye→public cutover aborted (${detail}). ` +
            `Legacy data was left untouched in the "ye" schema; resolve the listed tables manually ` +
            `(or clear the conflicting public rows) and redeploy.`,
        );
      }
      console.log('[legacy-schema-migration] result:', JSON.stringify(res));
    }
  }

  let sweeping = false;
  const runSweep = async () => {
    // A large backlog may span timer ticks. Let its committed batches finish
    // rather than starting another copy of all maintenance in this process.
    if (sweeping) return;
    sweeping = true;
    try {
      await runMaintenance();
    } finally {
      sweeping = false;
    }
  };

  const runMaintenance = async () => {
    try {
      const { purgeExpiredChat } = await import('@/lib/chat-retention');
      await purgeExpiredChat();
    } catch (e) {
      console.error('[chat-retention] periodic cleanup failed:', e);
    }
    try {
      const { sweepAbuseRetention } = await import('@/lib/abuse-retention');
      await sweepAbuseRetention();
    } catch (e) {
      console.error('[abuse-retention] periodic cleanup failed:', e);
    }
    try {
      const { sweepStalePayments } = await import('@/lib/pay-core');
      const { settled, expired, errors } = await sweepStalePayments();
      if (settled || expired || errors) {
        console.log(`[payments] periodic sweep: settled=${settled} expired=${expired} errors=${errors}`);
      }
    } catch (e) {
      console.error('[payments] periodic sweep failed:', e);
    }
    // NELC production outbox: retry pending real-learner statements. No-op
    // outside the published deployment or without production LRS secrets;
    // logs its own result only when it actually attempted rows.
    try {
      const { flushOutboxServer } = await import('@/lib/xapiOutbox');
      await flushOutboxServer();
    } catch (e) {
      console.error('[nelc-outbox] periodic flush failed:', e);
    }
    // Keep the Google connector out of the instrumentation bundle (its SDK
    // depends on node:child_process, which Next's instrumentation compiler
    // cannot bundle). The protected localhost route owns the actual worker.
    try {
      const port = process.env.PORT;
      const secret = process.env.SESSION_SECRET;
      if (port && secret) {
        const res = await fetch(`http://127.0.0.1:${port}/svc/trial-followups/sweep`, {
          method: 'POST',
          headers: { 'x-internal-sweep': secret },
        });
        if (!res.ok) console.error(`[trial-followup] periodic delivery returned ${res.status}`);
      }
    } catch (e) {
      console.error('[trial-followup] periodic delivery failed:', e);
    }
  };

  const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);
  timer.unref?.(); // never keep the process alive just for the sweep
  globalThis.__yeSweepTimer = timer;

  const kickoff = setTimeout(runSweep, INITIAL_DELAY_MS);
  kickoff.unref?.();

  console.log('[payments] periodic stale-payment sweep scheduled (every 10 min)');
}
