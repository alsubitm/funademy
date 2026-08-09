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

export interface OneTimeChargeParams {
  userId: number;
  amountSar: number;
  description: string;
  /** Stable key so retries never double-charge (e.g. `booking-<id>`). */
  idempotencyKey?: string;
}

export interface OneTimeChargeResult {
  /** Provider-verified amount actually charged. */
  amountSar: number;
  /** paid = charge captured; anything else must not grant entitlements. */
  status: "paid" | "failed";
  reference: string;
}

export interface PaymentProvider {
  name: string;
  startSubscription(
    params: StartSubscriptionParams,
  ): Promise<ProviderSubscriptionResult>;
  cancelSubscription(userId: number): Promise<void>;
  /** One-time charge (session single purchase, session credit packages). */
  chargeOneTime(params: OneTimeChargeParams): Promise<OneTimeChargeResult>;
  /** Refund a previously captured one-time charge by its provider reference. */
  refundOneTime(params: {
    userId: number;
    amountSar: number;
    reference: string;
    /** Stable key so retries never double-refund (e.g. `refund-booking-<id>`). */
    idempotencyKey?: string;
  }): Promise<{ status: "refunded" | "failed"; reference: string }>;
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
  async chargeOneTime(params) {
    // Demo provider approves without contacting a gateway — same policy as
    // subscriptions (Stripe integration was declined). Swap the provider to
    // enforce real card capture before entitlements are granted.
    // Test hook: integration tests set DEMO_PAYMENTS_DECLINE=1 to exercise
    // the declined-charge paths (seat release, waitlist promotion).
    if (process.env.DEMO_PAYMENTS_DECLINE === "1") {
      return { amountSar: params.amountSar, status: "failed", reference: "" };
    }
    return {
      amountSar: params.amountSar,
      status: "paid",
      reference: params.idempotencyKey
        ? `demo-${params.idempotencyKey}`
        : `demo-${Date.now()}-${params.userId}`,
    };
  },
  async refundOneTime(params) {
    // Demo provider approves refunds without contacting a gateway. The
    // reference is deterministic per idempotency key, so retries map to the
    // same provider-side refund.
    return {
      status: "refunded",
      reference: params.idempotencyKey ?? `refund-${params.reference}`,
    };
  },
};

export const activeProvider: PaymentProvider = demoProvider;
