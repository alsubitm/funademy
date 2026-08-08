/**
 * Payment providers — STUB (Phase 1).
 *
 * PAYMENT INTEGRATION POINT
 * -------------------------
 * This module is the single place where real providers plug in later:
 *   - Moyasar (Mada / Apple Pay / STC Pay): create a payment via the Moyasar
 *     API inside `createPayment()`, return its id + redirect/3DS URL, and
 *     confirm via webhook or a verify call before enrollments activate.
 *   - Tamara (BNPL): create a checkout session and redirect the parent.
 * Until then `createPayment()` SIMULATES an immediately-successful payment —
 * clearly marked in the UI — so the enrollment flow can be exercised
 * end to end without charging anyone.
 */

export type PaymentProvider = 'moyasar_mada' | 'moyasar_applepay' | 'moyasar_stcpay' | 'tamara';

export const PAYMENT_PROVIDERS: PaymentProvider[] = [
  'moyasar_mada',
  'moyasar_applepay',
  'moyasar_stcpay',
  'tamara',
];

export type PaymentResult =
  | { status: 'paid'; reference: string; provider: PaymentProvider; amountSar: number; simulated: true }
  | { status: 'failed'; provider: PaymentProvider; error: string };

export async function createPayment(
  provider: PaymentProvider,
  amountSar: number,
  description: string,
): Promise<PaymentResult> {
  if (!PAYMENT_PROVIDERS.includes(provider)) {
    return { status: 'failed', provider, error: 'unknown_provider' };
  }
  if (!(amountSar > 0)) {
    return { status: 'failed', provider, error: 'invalid_amount' };
  }
  // ← Real Moyasar / Tamara API calls go here.
  void description;
  return {
    status: 'paid',
    reference: `SIM-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    provider,
    amountSar,
    simulated: true,
  };
}
