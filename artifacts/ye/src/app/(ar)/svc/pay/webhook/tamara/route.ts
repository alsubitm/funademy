import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { prisma, withDbRetry } from '@/lib/db';
import { finalizePayment } from '@/lib/pay-core';

export const dynamic = 'force-dynamic';

/**
 * Tamara notification webhook. Configure in Tamara Merchant Portal with the
 * notification key saved as TAMARA_NOTIFICATION_TOKEN.
 *
 * SECURITY
 * --------
 * - Fails closed (503) when TAMARA_NOTIFICATION_TOKEN is not configured.
 * - Verifies the JWT `tamaraToken` Tamara attaches to every notification
 *   (as `Authorization: Bearer <jwt>` and/or `?tamaraToken=` query param),
 *   signed HS256 with the merchant's notification token
 *   (per https://docs.tamara.co/docs/webhook-subscription).
 * - Lookup is restricted to provider='tamara' to prevent cross-provider
 *   injection (e.g. a forged payload supplying a Moyasar payment ID).
 *
 * The payload is only used to LOCATE our payment — the order status is
 * re-verified against the Tamara API (which also authorises/captures).
 */

function b64urlDecode(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

/** Verify an HS256 JWT signed with the Tamara notification token. */
function verifyTamaraJwt(notificationToken: string, jwt: string | null): boolean {
  if (!jwt) return false;
  const parts = jwt.split('.');
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, sigB64] = parts;
  try {
    const header = JSON.parse(b64urlDecode(headerB64).toString('utf8'));
    if (header.alg !== 'HS256') return false;
    const expected = createHmac('sha256', notificationToken)
      .update(`${headerB64}.${payloadB64}`)
      .digest();
    const actual = b64urlDecode(sigB64);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
    const payload = JSON.parse(b64urlDecode(payloadB64).toString('utf8'));
    if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) return false;
    return true;
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
  const auth = req.headers.get('authorization');
  const bearer = auth?.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : null;
  const queryToken = req.nextUrl.searchParams.get('tamaraToken');
  if (!verifyTamaraJwt(token, bearer ?? queryToken)) {
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
  const payment = await withDbRetry(() => prisma.payment.findFirst({
    where: {
      provider: 'tamara',
      ...(Number.isInteger(orderRef) && orderRef > 0
        ? { id: orderRef }
        : orderId
          ? { reference: orderId }
          : { id: -1 }),
    },
  }), { operation: 'tamara-webhook-payment-read' });
  if (!payment) return NextResponse.json({ ok: true, note: 'payment_not_found' });

  const outcome = await finalizePayment(payment.id);
  return NextResponse.json({ ok: true, outcome });
}
