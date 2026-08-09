import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { finalizePayment } from '@/lib/pay-core';

export const dynamic = 'force-dynamic';

/**
 * Tamara notification webhook. Configure in Tamara Merchant Portal with the
 * notification key saved as TAMARA_NOTIFICATION_TOKEN.
 *
 * SECURITY
 * --------
 * - Fails closed (503) when TAMARA_NOTIFICATION_TOKEN is not configured.
 * - Validates Tamara's HMAC-SHA256 signature (header: Tamara-Signature).
 * - Lookup is restricted to provider='tamara' to prevent cross-provider
 *   injection (e.g. a forged payload supplying a Moyasar payment ID).
 *
 * The payload is only used to LOCATE our payment — the order status is
 * re-verified against the Tamara API (which also authorises/captures).
 */

function verifyTamaraSignature(token: string, rawBody: string, header: string | null): boolean {
  if (!header) return false;
  // Tamara signs: HMAC-SHA256(notification_token, rawBody), hex-encoded.
  const expected = createHmac('sha256', token).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const token = process.env.TAMARA_NOTIFICATION_TOKEN;
  if (!token) {
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const rawBody = await req.text();
  const signature = req.headers.get('tamara-signature');
  if (!verifyTamaraSignature(token, rawBody, signature)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const orderId = typeof body.order_id === 'string' ? body.order_id : null;
  const orderRef = Number(body.order_reference_id);

  // Restrict lookup to Tamara payments only — never match Moyasar payments.
  const payment = await prisma.payment.findFirst({
    where: {
      provider: 'tamara',
      ...(Number.isInteger(orderRef) && orderRef > 0
        ? { id: orderRef }
        : orderId
          ? { reference: orderId }
          : { id: -1 }),
    },
  });
  if (!payment) return NextResponse.json({ ok: true, note: 'payment_not_found' });

  const outcome = await finalizePayment(payment.id);
  return NextResponse.json({ ok: true, outcome });
}
