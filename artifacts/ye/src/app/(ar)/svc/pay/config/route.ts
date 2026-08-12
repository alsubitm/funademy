import { NextResponse } from 'next/server';
import { moyasarLive, tamaraLive, paymentAvailability } from '@/lib/payments';

export const dynamic = 'force-dynamic';

/** Which providers are live (credentials configured) and which methods may be
 * OFFERED right now — on the published site non-live providers are hidden
 * entirely (no simulated checkout in production), and Tamara is only offered
 * when the merchant account actually has payment types enabled.
 * No secrets are exposed. */
export async function GET() {
  const available = await paymentAvailability();
  return NextResponse.json({ moyasar: moyasarLive(), tamara: tamaraLive(), available });
}
