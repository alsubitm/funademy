/**
 * Subscription billing helpers — one calendar month per payment.
 */

/** Add one calendar month, clamping to the last day of shorter months. */
export function addOneMonth(d: Date): Date {
  const r = new Date(d);
  const day = r.getDate();
  r.setMonth(r.getMonth() + 1);
  if (r.getDate() !== day) r.setDate(0); // clamp (e.g. Jan 31 → Feb 28)
  return r;
}

/** Effective monthly price in SAR after the sibling discount. */
export function effectiveMonthlySar(monthlyPriceSar: number, discountPct: number): number {
  return Math.round(monthlyPriceSar * (100 - discountPct)) / 100;
}

export type SubscriptionState = 'paid' | 'due_soon' | 'due' | 'none';

/** Classify an enrollment's subscription based on its paidThrough date. */
export function subscriptionState(paidThrough: Date | null, now = new Date()): SubscriptionState {
  if (!paidThrough) return 'none';
  if (paidThrough <= now) return 'due';
  const soon = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (paidThrough <= soon) return 'due_soon';
  return 'paid';
}
