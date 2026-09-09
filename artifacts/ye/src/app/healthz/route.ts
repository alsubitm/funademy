import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Process-readiness check. Database health is monitored separately so a
 * transient database restart does not make the whole Next.js process unhealthy. */
export function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { 'Cache-Control': 'no-store' } },
  );
}