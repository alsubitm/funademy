import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { finalizePayment } from '@/lib/pay-core';

export const dynamic = 'force-dynamic';

/**
 * Moyasar webhook. Configure in the Moyasar dashboard pointing at
 * `https://<domain>/svc/pay/webhook/moyasar` with a shared secret saved as
 * MOYASAR_WEBHOOK_SECRET.
 *
 * SECURITY
 * --------
 * - Fails closed (503) when MOYASAR_WEBHOOK_SECRET is not configured.
 * - Validates Moyasar's HMAC signature before doing anything.
 * - Lookup is restricted to Moyasar providers to prevent cross-provider
 *   injection attacks (e.g. a Tamara webhook supplying a Moyasar payment ID).
 *
 * The payload is only used to LOCATE our payment — the status is always
 * re-verified against the Moyasar API (see pay-core.ts / payments.ts).
 */

const MOYASAR_PROVIDERS: string[] = ['moyasar_mada', 'moyasar_applepay', 'moyasar_stcpay'];

/** Verify Moyasar HMAC-SHA256 signature (header: X-Moyasar-Signature). */
function verifyMoyasarSignature(secret: string, rawBody: string, header: string | null): boolean {
  if (!header) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const secret = process.env.MOYASAR_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed: do not process webhooks without a shared secret configured.
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('x-moyasar-signature');
  if (!verifyMoyasarSignature(secret, rawBody, signature)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const data = (body.data ?? {}) as Record<string, unknown>;
  const metadata = (data.metadata ?? {}) as Record<string, unknown>;
  const candidates = [data.invoice_id, data.id].filter((v): v is string => typeof v === 'string');
  const orderRef = Number(metadata.order_ref);

  // Restrict lookup to Moyasar providers — never match Tamara or other payments.
  const payment = await prisma.payment.findFirst({
    where: {
      provider: { in: MOYASAR_PROVIDERS },
      ...(Number.isInteger(orderRef) && orderRef > 0
        ? { id: orderRef }
        : { reference: { in: candidates } }),
    },
  });
  if (!payment) return NextResponse.json({ ok: true, note: 'payment_not_found' });

  const outcome = await finalizePayment(payment.id);
  return NextResponse.json({ ok: true, outcome });
}
