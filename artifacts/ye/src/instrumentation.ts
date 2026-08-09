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

  const runSweep = async () => {
    try {
      const { sweepStalePayments } = await import('@/lib/pay-core');
      const { settled, expired, errors } = await sweepStalePayments();
      if (settled || expired || errors) {
        console.log(`[payments] periodic sweep: settled=${settled} expired=${expired} errors=${errors}`);
      }
    } catch (e) {
      console.error('[payments] periodic sweep failed:', e);
    }
  };

  const timer = setInterval(runSweep, SWEEP_INTERVAL_MS);
  timer.unref?.(); // never keep the process alive just for the sweep
  globalThis.__yeSweepTimer = timer;

  const kickoff = setTimeout(runSweep, INITIAL_DELAY_MS);
  kickoff.unref?.();

  console.log('[payments] periodic stale-payment sweep scheduled (every 10 min)');
}
