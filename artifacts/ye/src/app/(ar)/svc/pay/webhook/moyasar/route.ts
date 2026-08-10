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
 * - Verifies the `secret_token` field Moyasar includes in every webhook
 *   payload (per https://docs.moyasar.com/api/other/webhooks/webhook-reference)
 *   against MOYASAR_WEBHOOK_SECRET using a timing-safe comparison.
 * - Lookup is restricted to Moyasar providers to prevent cross-provider
 *   injection attacks (e.g. a Tamara webhook supplying a Moyasar payment ID).
 *
 * The payload is only used to LOCATE our payment — the status is always
 * re-verified against the Moyasar API (see pay-core.ts / payments.ts).
 */

const MOYASAR_PROVIDERS: string[] = ['moyasar_mada', 'moyasar_applepay', 'moyasar_stcpay'];

/** Timing-safe comparison of the payload's secret_token with our secret. */
function verifySecretToken(secret: string, provided: unknown): boolean {
  if (typeof provided !== 'string' || provided.length === 0) return false;
  const a = createHmac('sha256', 'cmp').update(provided).digest();
  const b = createHmac('sha256', 'cmp').update(secret).digest();
  return timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const secret = process.env.MOYASAR_WEBHOOK_SECRET;
  if (!secret) {
    // Fail closed: do not process webhooks without a shared secret configured.
    return NextResponse.json({ error: 'webhook_not_configured' }, { status: 503 });
  }

  const rawBody = await req.text();

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  if (!verifySecretToken(secret, body.secret_token)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
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
