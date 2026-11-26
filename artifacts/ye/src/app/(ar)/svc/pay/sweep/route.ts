import { NextRequest, NextResponse } from 'next/server';
import { sweepStalePayments } from '@/lib/pay-core';
import { secretsEqual } from '@/lib/secure-compare';

export const dynamic = 'force-dynamic';

/**
 * Out-of-band sweep endpoint. Intended to be called by an external cron
 * service (e.g. a Replit Scheduled Deployment, Uptime Robot, GitHub Actions
 * scheduled workflow, or any HTTP pinger) every 10–15 minutes.
 *
 * Protected ONLY by its own SWEEP_SECRET env var. It deliberately does NOT
 * fall back to ADMIN_PASSWORD: that would let anyone guess the admin
 * password here without the admin-login throttle, and would require handing
 * the admin password to a third-party cron service.
 * Call with:  POST /svc/pay/sweep  +  Authorization: Bearer <SWEEP_SECRET>
 *
 * No secret configured → rejects all callers (fail-closed). The in-process
 * timer (instrumentation.ts) calls sweepStalePayments() directly and does
 * not depend on this endpoint.
 */
export async function POST(req: NextRequest) {
  const expected = process.env.SWEEP_SECRET;
  if (!expected) {
    return NextResponse.json({ error: 'sweep_not_configured' }, { status: 503 });
  }

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (!token || !secretsEqual(token, expected)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { settled, expired, errors } = await sweepStalePayments();
  return NextResponse.json({ ok: true, settled, expired, errors });
}
