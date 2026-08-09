import { NextRequest, NextResponse } from 'next/server';
import { sweepStalePayments } from '@/lib/pay-core';

export const dynamic = 'force-dynamic';

/**
 * Out-of-band sweep endpoint. Intended to be called by an external cron
 * service (e.g. Uptime Robot, GitHub Actions scheduled workflow, or any HTTP
 * pinger) every 10–15 minutes.
 *
 * Protected by the SWEEP_SECRET env var (or ADMIN_PASSWORD as fallback).
 * Call with:  POST /svc/pay/sweep  +  Authorization: Bearer <secret>
 *
 * No secret configured → rejects all callers (fail-closed).
 */
export async function POST(req: NextRequest) {
  const expected = process.env.SWEEP_SECRET ?? process.env.ADMIN_PASSWORD;
  if (!expected) {
    return NextResponse.json({ error: 'sweep_not_configured' }, { status: 503 });
  }

  const auth = req.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const { settled, expired, errors } = await sweepStalePayments();
  return NextResponse.json({ ok: true, settled, expired, errors });
}
