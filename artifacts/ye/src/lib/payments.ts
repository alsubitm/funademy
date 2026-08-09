/**
 * Payment providers — Moyasar (Mada / Apple Pay / STC Pay) + Tamara (BNPL).
 *
 * LIVE vs SIMULATED
 * -----------------
 * A provider goes live automatically when its credential secret is present:
 *   - Moyasar: MOYASAR_SECRET_KEY  (optional: MOYASAR_API_BASE)
 *   - Tamara:  TAMARA_API_TOKEN    (optional: TAMARA_API_BASE — set to
 *              https://api-sandbox.tamara.co for sandbox testing)
 * Without the secret, `createPayment()` falls back to an immediately-paid
 * SIMULATED result (clearly flagged in the UI/receipts) so the flow keeps
 * working in development.
 *
 * LIVE FLOW
 * ---------
 * 1. `createPayment()` creates a provider checkout (Moyasar invoice / Tamara
 *    checkout session) and returns `{ status: 'redirect', redirectUrl }`.
 * 2. The parent pays on the provider's hosted page (3DS handled there) and is
 *    sent back to our callback URL; the provider may also POST our webhook.
 * 3. `verifyPayment()` asks the provider for the authoritative status — we
 *    never trust redirect query params. Finalization lives in pay-core.ts.
 */

export type PaymentProvider = 'moyasar_mada' | 'moyasar_applepay' | 'moyasar_stcpay' | 'tamara';

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  'moyasar_mada',
  'moyasar_applepay',
  'moyasar_stcpay',
  'tamara',
];

const MOYASAR_BASE = () => process.env.MOYASAR_API_BASE || 'https://api.moyasar.com';
const TAMARA_BASE = () => process.env.TAMARA_API_BASE || 'https://api.tamara.co';

export function moyasarLive(): boolean {
  return Boolean(process.env.MOYASAR_SECRET_KEY);
}
export function tamaraLive(): boolean {
  return Boolean(process.env.TAMARA_API_TOKEN);
}
export function providerLive(provider: PaymentProvider): boolean {
  return provider === 'tamara' ? tamaraLive() : moyasarLive();
}

export type CreatePaymentOptions = {
  /** Absolute URL the customer returns to after paying (we verify server-side). */
  callbackUrl: string;
  /** Our internal payment row id, echoed back by the provider. */
  orderRef: string;
  /** Customer details (required by Tamara). */
  consumer: { name: string; phone: string; email?: string | null };
  /** Receipt line descriptions (used by Tamara's itemized checkout). */
  lines?: { name: string; totalSar: number }[];
};

export type PaymentResult =
  | { status: 'paid'; reference: string; provider: PaymentProvider; amountSar: number; simulated: true }
  | { status: 'redirect'; reference: string; redirectUrl: string; provider: PaymentProvider; amountSar: number }
  | { status: 'failed'; provider: PaymentProvider; error: string };

export async function createPayment(
  provider: PaymentProvider,
  amountSar: number,
  description: string,
  opts?: CreatePaymentOptions,
): Promise<PaymentResult> {
  if (!PAYMENT_PROVIDERS.includes(provider)) {
    return { status: 'failed', provider, error: 'unknown_provider' };
  }
  if (!(amountSar > 0)) {
    return { status: 'failed', provider, error: 'invalid_amount' };
  }

  if (!providerLive(provider) || !opts) {
    // SIMULATED fallback — no credentials configured for this provider.
    void description;
    return {
      status: 'paid',
      reference: `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      provider,
      amountSar,
      simulated: true,
    };
  }

  try {
    return provider === 'tamara'
      ? await createTamaraCheckout(amountSar, description, opts)
      : await createMoyasarInvoice(provider, amountSar, description, opts);
  } catch (e) {
    console.error(`[payments] createPayment ${provider} failed:`, e);
    return { status: 'failed', provider, error: 'provider_error' };
  }
}

export type VerifyResult = 'paid' | 'pending' | 'failed';

/** Ask the provider for the authoritative payment status. */
export async function verifyPayment(provider: PaymentProvider, reference: string): Promise<VerifyResult> {
  if (reference.startsWith('SIM-')) return 'paid';
  if (!providerLive(provider)) return 'pending'; // can't verify without credentials — never fail blindly
  try {
    return provider === 'tamara' ? await verifyTamara(reference) : await verifyMoyasar(reference);
  } catch (e) {
    console.error(`[payments] verifyPayment ${provider} ${reference} error:`, e);
    return 'pending'; // transient error — retry later, do not release seats
  }
}

/* ----------------------------- Moyasar ----------------------------- */

const moyasarAuth = () =>
  `Basic ${Buffer.from(`${process.env.MOYASAR_SECRET_KEY}:`).toString('base64')}`;

async function createMoyasarInvoice(
  provider: PaymentProvider,
  amountSar: number,
  description: string,
  opts: CreatePaymentOptions,
): Promise<PaymentResult> {
  // Hosted invoice page: supports mada, Apple Pay and STC Pay (whichever are
  // enabled on the Moyasar dashboard). 3DS is handled by Moyasar.
  const res = await fetch(`${MOYASAR_BASE()}/v1/invoices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: moyasarAuth() },
    body: JSON.stringify({
      amount: Math.round(amountSar * 100), // halalas
      currency: 'SAR',
      description,
      callback_url: opts.callbackUrl,
      success_url: opts.callbackUrl,
      back_url: opts.callbackUrl,
      metadata: { order_ref: opts.orderRef, preferred_method: provider },
    }),
  });
  const data = (await res.json()) as { id?: string; url?: string; message?: string };
  if (!res.ok || !data.id || !data.url) {
    console.error('[payments] Moyasar invoice error:', res.status, data);
    return { status: 'failed', provider, error: 'provider_error' };
  }
  return { status: 'redirect', reference: data.id, redirectUrl: data.url, provider, amountSar };
}

async function verifyMoyasar(invoiceId: string): Promise<VerifyResult> {
  const res = await fetch(`${MOYASAR_BASE()}/v1/invoices/${encodeURIComponent(invoiceId)}`, {
    headers: { Authorization: moyasarAuth() },
    cache: 'no-store',
  });
  if (res.status === 404) return 'failed';
  const data = (await res.json()) as { status?: string };
  if (!res.ok) throw new Error(`moyasar_verify_${res.status}`);
  if (data.status === 'paid') return 'paid';
  if (data.status === 'expired' || data.status === 'canceled' || data.status === 'voided' || data.status === 'failed') return 'failed';
  return 'pending';
}

/* ------------------------------ Tamara ----------------------------- */

const tamaraHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${process.env.TAMARA_API_TOKEN}`,
});

function splitName(name: string): { first: string; last: string } {
  const parts = name.trim().split(/\s+/);
  return { first: parts[0] || 'Parent', last: parts.slice(1).join(' ') || 'Family' };
}

async function createTamaraCheckout(
  amountSar: number,
  description: string,
  opts: CreatePaymentOptions,
): Promise<PaymentResult> {
  const { first, last } = splitName(opts.consumer.name);
  const money = (v: number) => ({ amount: Math.round(v * 100) / 100, currency: 'SAR' });
  const items = (opts.lines?.length ? opts.lines : [{ name: description, totalSar: amountSar }]).map((l, i) => ({
    reference_id: `${opts.orderRef}-${i + 1}`,
    type: 'Digital',
    name: l.name.slice(0, 255),
    sku: `FUNADEMY-${i + 1}`,
    quantity: 1,
    total_amount: money(l.totalSar),
  }));
  const res = await fetch(`${TAMARA_BASE()}/checkout`, {
    method: 'POST',
    headers: tamaraHeaders(),
    body: JSON.stringify({
      order_reference_id: opts.orderRef,
      total_amount: money(amountSar),
      description: description.slice(0, 255),
      country_code: 'SA',
      payment_type: 'PAY_BY_INSTALMENTS',
      locale: 'ar_SA',
      items,
      consumer: {
        first_name: first,
        last_name: last,
        phone_number: opts.consumer.phone,
        email: opts.consumer.email || 'noreply@funademy.sa',
      },
      shipping_address: { first_name: first, last_name: last, line1: 'Riyadh', city: 'Riyadh', country_code: 'SA' },
      tax_amount: money(0),
      shipping_amount: money(0),
      merchant_url: {
        success: opts.callbackUrl,
        failure: `${opts.callbackUrl}&pr=failure`,
        cancel: `${opts.callbackUrl}&pr=cancel`,
        notification: opts.callbackUrl.replace(/\/svc\/pay\/return.*$/, '/svc/pay/webhook/tamara'),
      },
    }),
  });
  const data = (await res.json()) as { order_id?: string; checkout_url?: string; message?: string };
  if (!res.ok || !data.order_id || !data.checkout_url) {
    console.error('[payments] Tamara checkout error:', res.status, data);
    return { status: 'failed', provider: 'tamara', error: 'provider_error' };
  }
  return { status: 'redirect', reference: data.order_id, redirectUrl: data.checkout_url, provider: 'tamara', amountSar };
}

async function verifyTamara(orderId: string): Promise<VerifyResult> {
  const res = await fetch(`${TAMARA_BASE()}/orders/${encodeURIComponent(orderId)}`, {
    headers: tamaraHeaders(),
    cache: 'no-store',
  });
  if (res.status === 404) return 'failed';
  const data = (await res.json()) as { status?: string; total_amount?: { amount: number } };
  if (!res.ok) throw new Error(`tamara_verify_${res.status}`);
  const status = (data.status || '').toLowerCase();

  // fully_captured (or partially_captured) = money is in hand, no more action needed.
  if (status === 'fully_captured' || status === 'partially_captured') return 'paid';

  if (status === 'approved') {
    // Approved orders must be authorised to secure the funds.
    const auth = await fetch(`${TAMARA_BASE()}/orders/${encodeURIComponent(orderId)}/authorise`, {
      method: 'POST',
      headers: tamaraHeaders(),
    });
    if (!auth.ok && auth.status !== 409) {
      // 409 = already authorised elsewhere; anything else → still pending.
      console.error('[payments] Tamara authorise error:', auth.status, await auth.text().catch(() => ''));
      return 'pending';
    }
    // After authorise, capture. If capture fails, leave pending for retry.
    const captured = await captureTamara(orderId, data.total_amount?.amount);
    return captured ? 'paid' : 'pending';
  }

  if (status === 'authorised') {
    // Already authorised — move straight to capture.
    const captured = await captureTamara(orderId, data.total_amount?.amount);
    return captured ? 'paid' : 'pending';
  }

  if (status === 'declined' || status === 'expired' || status === 'canceled') return 'failed';
  return 'pending';
}

/**
 * Attempt to capture a Tamara order.
 * Returns true if capture succeeded (or was already captured — 409),
 * false on any transient or permanent failure so the caller can keep
 * the internal payment in `initiated` state and retry later.
 */
async function captureTamara(orderId: string, amount?: number): Promise<boolean> {
  if (!amount) {
    console.error('[payments] Tamara capture skipped: no amount available for order', orderId);
    return false;
  }
  try {
    const res = await fetch(`${TAMARA_BASE()}/payments/capture`, {
      method: 'POST',
      headers: tamaraHeaders(),
      body: JSON.stringify({
        order_id: orderId,
        total_amount: { amount, currency: 'SAR' },
        tax_amount: { amount: 0, currency: 'SAR' },
        shipping_amount: { amount: 0, currency: 'SAR' },
        shipping_info: { shipped_at: new Date().toISOString(), shipping_company: 'N/A' },
      }),
    });
    if (res.ok || res.status === 409) return true; // 409 = already captured
    console.error('[payments] Tamara capture error:', res.status, await res.text().catch(() => ''));
    return false;
  } catch (e) {
    console.error('[payments] Tamara capture network error:', e);
    return false;
  }
}
