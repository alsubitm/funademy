/**
 * Payment provider abstraction.
 *
 * All billing operations go through this single service so a local Saudi
 * gateway (Moyasar, Tap) or Stripe can be swapped in by implementing the
 * PaymentProvider interface and changing `activeProvider` below.
 */

export interface StartSubscriptionParams {
  userId: number;
  plan: "monthly" | "annual";
  couponCode?: string | null;
  cardLast4?: string | null;
}

export interface ProviderSubscriptionResult {
  priceSar: number;
  trialDays: number;
}

export interface PaymentProvider {
  name: string;
  startSubscription(
    params: StartSubscriptionParams,
  ): Promise<ProviderSubscriptionResult>;
  cancelSubscription(userId: number): Promise<void>;
}

const PLAN_PRICES: Record<"monthly" | "annual", number> = {
  monthly: 49,
  annual: 399,
};

const COUPONS: Record<string, number> = {
  FOUNDING50: 0.5, // founding-family discount: 50% off
  WELCOME10: 0.9,
};

export function priceFor(
  plan: "monthly" | "annual",
  couponCode?: string | null,
): number {
  const base = PLAN_PRICES[plan];
  const multiplier = couponCode ? (COUPONS[couponCode.toUpperCase()] ?? 1) : 1;
  return Math.round(base * multiplier * 100) / 100;
}

export function isValidCoupon(code: string): boolean {
  return code.toUpperCase() in COUPONS;
}

/**
 * Demo provider: records the subscription locally without charging a card.
 * Replace with a Stripe/Moyasar/Tap implementation for real billing.
 */
const demoProvider: PaymentProvider = {
  name: "demo",
  async startSubscription(params) {
    return { priceSar: priceFor(params.plan, params.couponCode), trialDays: 7 };
  },
  async cancelSubscription() {
    // no-op for the demo provider
  },
};

export const activeProvider: PaymentProvider = demoProvider;
