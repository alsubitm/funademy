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

/** Published deployment — same gating pattern as outboxActive() in xapiOutbox.ts. */
export function productionDeployment(): boolean {
  return process.env.REPLIT_DEPLOYMENT === '1';
}

/* ---- Tamara payment-types availability (cached) ----
 * A live Tamara token is NOT enough: the merchant account must have at least
 * one payment type enabled, otherwise every checkout dies with
 * `payment_type_unsupported` (production incident 2026-08-12). We poll
 * GET /checkout/payment-types and cache the answer briefly.
 * Returns: true = types enabled, false = definitively NONE ([]),
 * null = could not determine (network/provider error) — callers treat null
 * as available so a transient outage doesn't hide a working method. */
const TAMARA_TYPES_TTL_MS = 5 * 60 * 1000;
let tamaraTypesCache: { value: boolean | null; at: number } | null = null;

/** Test hook — clears the payment-types cache. */
export function resetTamaraPaymentTypesCache(): void {
  tamaraTypesCache = null;
}

export async function tamaraPaymentTypesAvailable(): Promise<boolean | null> {
  if (!tamaraLive()) return null;
  if (tamaraTypesCache && Date.now() - tamaraTypesCache.at < TAMARA_TYPES_TTL_MS) {
    return tamaraTypesCache.value;
  }
  let value: boolean | null = null;
  try {
    const res = await fetch(`${TAMARA_BASE()}/checkout/payment-types?country=SA&currency=SAR`, {
      headers: tamaraHeaders(),
      cache: 'no-store',
    });
    if (res.ok) {
      const data = (await res.json()) as unknown;
      value = Array.isArray(data) ? data.length > 0 : null;
    } else {
      console.error('[payments] Tamara payment-types error:', res.status);
    }
  } catch (e) {
    console.error('[payments] Tamara payment-types network error:', e);
  }
  // Cache definitive answers; also cache unknown briefly to avoid hammering.
  tamaraTypesCache = { value, at: Date.now() };
  return value;
}

/**
 * Which payment methods the UI may OFFER right now.
 * - Development (no REPLIT_DEPLOYMENT): everything is offered — non-live
 *   providers run the clearly-flagged simulated flow.
 * - Production: only live providers, and Tamara additionally requires the
 *   merchant account to have payment types enabled.
 */
export async function paymentAvailability(): Promise<{ moyasar: boolean; tamara: boolean }> {
  const prod = productionDeployment();
  const moyasar = moyasarLive() || !prod;
  let tamara: boolean;
  if (tamaraLive()) {
    tamara = (await tamaraPaymentTypesAvailable()) !== false;
  } else {
    tamara = !prod;
  }
  return { moyasar, tamara };
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
  | { status: 'failed'; provider: PaymentProvider; error: string; indeterminate?: false }
  | { status: 'indeterminate'; provider: PaymentProvider; error: string; reference?: string };

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
    if (productionDeployment()) {
      // NEVER simulate on the published site — a visitor must not finish
      // checkout without real money collected (incident 2026-08-12).
      console.error(`[payments] createPayment ${provider} refused: provider not configured in production`);
      return { status: 'failed', provider, error: 'provider_not_configured' };
    }
    // SIMULATED fallback — development only, no credentials for this provider.
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
    if (provider === 'tamara' && (await tamaraPaymentTypesAvailable()) === false) {
      // Merchant account has NO payment types enabled — every checkout would
      // be rejected with payment_type_unsupported. Fail fast instead.
      console.error('[payments] createPayment tamara refused: no payment types enabled on merchant account');
      return { status: 'failed', provider: 'tamara', error: 'payment_type_unsupported' };
    }
    return provider === 'tamara'
      ? await createTamaraCheckout(amountSar, description, opts)
      : await createMoyasarInvoice(provider, amountSar, description, opts);
  } catch (e) {
    console.error(`[payments] createPayment ${provider} failed:`, e);
    // A timeout/lost response may mean the provider created the checkout even
    // though we did not receive its reference. Never release the hold or retry
    // creation blindly; the INIT order reference is reconciled separately.
    return { status: 'indeterminate', provider, error: 'provider_status_unknown' };
  }
}

export type CreationReconciliation =
  | { status: 'found'; reference: string }
  | { status: 'unknown' };

/** Locate a checkout by our unique order reference after a lost create response. */
export async function reconcilePaymentCreation(
  provider: PaymentProvider,
  orderRef: string,
): Promise<CreationReconciliation> {
  if (!providerLive(provider)) return { status: 'unknown' };
  try {
    if (provider === 'tamara') {
      const res = await fetch(`${TAMARA_BASE()}/orders?order_reference_id=${encodeURIComponent(orderRef)}`, {
        headers: tamaraHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) return { status: 'unknown' };
      const data = (await res.json().catch(() => ({}))) as { order_id?: string; orders?: { order_id?: string }[] };
      const reference = data.order_id || data.orders?.[0]?.order_id;
      return reference ? { status: 'found', reference } : { status: 'unknown' };
    }

    const res = await fetch(
      `${MOYASAR_BASE()}/v1/invoices?metadata[order_ref]=${encodeURIComponent(orderRef)}`,
      { headers: { Authorization: moyasarAuth() }, cache: 'no-store' },
    );
    if (!res.ok) return { status: 'unknown' };
    const data = (await res.json().catch(() => ({}))) as { id?: string; invoices?: { id?: string }[] };
    const reference = data.id || data.invoices?.[0]?.id;
    return reference ? { status: 'found', reference } : { status: 'unknown' };
  } catch (e) {
    console.error(`[payments] creation reconciliation ${provider} order ${orderRef} failed:`, e);
    return { status: 'unknown' };
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

/**
 * `indeterminate: true` means the provider MAY have executed the refund but
 * we could not confirm either way (network error, timeout, 5xx) even after
 * reconciliation. Callers must NOT allow an automatic retry in that case —
 * a second refund request could duplicate a real financial operation.
 * `indeterminate: false` is a definitive pre-execution rejection: no money
 * moved, retrying is safe.
 */
export type RefundResult =
  | { ok: true }
  | { ok: false; error: string; indeterminate: boolean };

/**
 * Refund a settled payment at the provider.
 * - SIM-* references succeed immediately (nothing was charged).
 * - Moyasar: the stored reference is an INVOICE id — we look up the underlying
 *   paid payment and POST /v1/payments/{id}/refund.
 * - Tamara: POST /payments/refund with the order id and full amount.
 * On ambiguous outcomes each provider path re-reads the payment/order state
 * to reconcile before reporting `indeterminate`.
 * Callers must only flip the internal status to `refunded` when `ok` is true.
 */
export async function refundPayment(
  provider: PaymentProvider,
  reference: string,
  amountSar: number,
): Promise<RefundResult> {
  if (reference.startsWith('SIM-')) return { ok: true }; // simulated — no real charge
  if (!providerLive(provider)) return { ok: false, error: 'provider_not_configured', indeterminate: false };
  try {
    return provider === 'tamara'
      ? await refundTamara(reference, amountSar)
      : await refundMoyasar(reference);
  } catch (e) {
    // Unexpected throw around the refund call — we cannot know whether the
    // provider executed it. Fail closed.
    console.error(`[payments] refundPayment ${provider} ${reference} error:`, e);
    return { ok: false, error: 'provider_error', indeterminate: true };
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
  const data = (await res.json().catch(() => ({}))) as { id?: string; url?: string; message?: string };
  if (!res.ok || !data.id || !data.url) {
    console.error('[payments] Moyasar invoice error:', res.status, data);
    return res.ok || res.status >= 500 || res.status === 408 || res.status === 429
      ? { status: 'indeterminate', provider, error: 'provider_status_unknown', reference: data.id }
      : { status: 'failed', provider, error: 'provider_error' };
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

async function refundMoyasar(invoiceId: string): Promise<RefundResult> {
  // The stored reference is an invoice id; refunds are made against the
  // underlying payment, so fetch the invoice to find the paid payment id.
  // A failure HERE is definitive — the refund itself was never attempted.
  let inv: { payments?: { id: string; status: string }[] };
  try {
    const invRes = await fetch(`${MOYASAR_BASE()}/v1/invoices/${encodeURIComponent(invoiceId)}`, {
      headers: { Authorization: moyasarAuth() },
      cache: 'no-store',
    });
    inv = (await invRes.json()) as typeof inv;
    if (!invRes.ok) {
      console.error('[payments] Moyasar refund: invoice lookup failed:', invRes.status, inv);
      return { ok: false, error: 'provider_error', indeterminate: false };
    }
  } catch (e) {
    console.error('[payments] Moyasar refund: invoice lookup network error:', e);
    return { ok: false, error: 'provider_error', indeterminate: false };
  }
  const paid = inv.payments?.find((p) => p.status === 'paid' || p.status === 'captured');
  if (!paid) {
    // Nothing settled behind this invoice, or already refunded at the provider.
    const refunded = inv.payments?.find((p) => p.status === 'refunded');
    if (refunded) return { ok: true }; // already refunded upstream — safe to record
    console.error('[payments] Moyasar refund: no paid payment on invoice', invoiceId, inv.payments);
    return { ok: false, error: 'no_paid_payment', indeterminate: false };
  }

  // The refund call itself — from here on any ambiguity must fail closed.
  try {
    const res = await fetch(`${MOYASAR_BASE()}/v1/payments/${encodeURIComponent(paid.id)}/refund`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: moyasarAuth() },
      body: JSON.stringify({}), // full refund
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; message?: string };
    if (res.ok && (data.status === 'refunded' || !data.status)) return { ok: true };
    if (res.status >= 400 && res.status < 500) {
      // Definitive rejection — Moyasar refused before executing anything.
      console.error('[payments] Moyasar refund rejected:', res.status, data);
      return { ok: false, error: 'provider_error', indeterminate: false };
    }
    console.error('[payments] Moyasar refund ambiguous response:', res.status, data);
  } catch (e) {
    console.error('[payments] Moyasar refund network error (outcome unknown):', e);
  }
  // Ambiguous (5xx / network error) — reconcile by re-reading the payment.
  return reconcileMoyasarRefund(paid.id);
}

/** After an ambiguous refund response, ask Moyasar what actually happened. */
async function reconcileMoyasarRefund(paymentId: string): Promise<RefundResult> {
  try {
    const res = await fetch(`${MOYASAR_BASE()}/v1/payments/${encodeURIComponent(paymentId)}`, {
      headers: { Authorization: moyasarAuth() },
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string };
    if (res.ok) {
      if (data.status === 'refunded') return { ok: true }; // refund did execute
      if (data.status === 'paid' || data.status === 'captured') {
        // Refund definitively did not happen — safe to retry later.
        return { ok: false, error: 'provider_error', indeterminate: false };
      }
    }
  } catch (e) {
    console.error('[payments] Moyasar refund reconciliation error:', e);
  }
  // Still unknown — fail closed, require manual reconciliation.
  return { ok: false, error: 'refund_status_unknown', indeterminate: true };
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
  const data = (await res.json().catch(() => ({}))) as { order_id?: string; checkout_url?: string; message?: string };
  if (!res.ok || !data.order_id || !data.checkout_url) {
    console.error('[payments] Tamara checkout error:', res.status, data);
    return res.ok || res.status >= 500 || res.status === 408 || res.status === 429
      ? { status: 'indeterminate', provider: 'tamara', error: 'provider_status_unknown', reference: data.order_id }
      : { status: 'failed', provider: 'tamara', error: 'provider_error' };
  }
  return { status: 'redirect', reference: data.order_id, redirectUrl: data.checkout_url, provider: 'tamara', amountSar };
}

async function refundTamara(orderId: string, amountSar: number): Promise<RefundResult> {
  try {
    const res = await fetch(`${TAMARA_BASE()}/payments/refund`, {
      method: 'POST',
      headers: tamaraHeaders(),
      body: JSON.stringify({
        order_id: orderId,
        total_amount: { amount: Math.round(amountSar * 100) / 100, currency: 'SAR' },
        comment: 'Admin refund from Funademy dashboard',
      }),
    });
    if (res.ok) return { ok: true };
    const body = await res.text().catch(() => '');
    if (res.status === 409) {
      // 409 usually means "already refunded", but don't take the provider's
      // word for it — reconcile against the order's actual refunded amount.
      console.error('[payments] Tamara refund 409, reconciling:', body);
      return reconcileTamaraRefund(orderId, amountSar, /*definitiveOnUnrefunded*/ true);
    }
    if (res.status >= 400 && res.status < 500) {
      // Definitive pre-execution rejection — nothing was refunded.
      console.error('[payments] Tamara refund rejected:', res.status, body);
      return { ok: false, error: 'provider_error', indeterminate: false };
    }
    console.error('[payments] Tamara refund ambiguous response:', res.status, body);
  } catch (e) {
    console.error('[payments] Tamara refund network error (outcome unknown):', e);
  }
  // 5xx or lost response — the refund may have executed. Reconcile.
  return reconcileTamaraRefund(orderId, amountSar, /*definitiveOnUnrefunded*/ false);
}

/**
 * Re-read the Tamara order to determine whether a refund actually executed.
 * `definitiveOnUnrefunded` distinguishes the 409 case (provider explicitly
 * refused, so an unrefunded order means retry is safe) from the lost-response
 * case (an unrefunded order still cannot rule out an in-flight refund).
 */
async function reconcileTamaraRefund(
  orderId: string,
  amountSar: number,
  definitiveOnUnrefunded: boolean,
): Promise<RefundResult> {
  try {
    const ord = await fetch(`${TAMARA_BASE()}/orders/${encodeURIComponent(orderId)}`, {
      headers: tamaraHeaders(),
      cache: 'no-store',
    });
    if (ord.ok) {
      const data = (await ord.json()) as { status?: string; refunded_amount?: { amount?: number } };
      const status = (data.status || '').toLowerCase();
      const refundedAmt = data.refunded_amount?.amount ?? 0;
      if (status === 'refunded' || status === 'fully_refunded' || refundedAmt >= amountSar) {
        return { ok: true }; // confirmed refunded upstream — safe to record
      }
      if (definitiveOnUnrefunded) {
        return { ok: false, error: 'provider_conflict', indeterminate: false };
      }
    }
  } catch (e) {
    console.error('[payments] Tamara refund reconciliation error:', e);
  }
  return { ok: false, error: 'refund_status_unknown', indeterminate: true };
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
