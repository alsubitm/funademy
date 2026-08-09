import { NextResponse } from 'next/server';
import { moyasarLive, tamaraLive } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/** Which providers are live (credentials configured) — drives the UI's
 * test-mode badges. No secrets are exposed. */
export async function GET() {
  return NextResponse.json({ moyasar: moyasarLive(), tamara: tamaraLive() });
}
