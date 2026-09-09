import { NextRequest, NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { finalizePayment } from '@/lib/pay-core';
import { CART_COOKIE } from '@/lib/cart';
import { verifyPaymentReturnState } from '@/lib/payment-return-state';

export const dynamic = 'force-dynamic';

/**
 * Customer return URL after paying on the provider's hosted page.
 * The redirect query params are NEVER trusted — the payment is verified
 * against the provider API (pay-core.ts) before anything activates.
 */
export async function GET(req: NextRequest) {
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'ar';
  const base = lang === 'en' ? '/en' : '';
  const state = verifyPaymentReturnState(req.nextUrl.searchParams.get('state'));

  if (!state) {
    return NextResponse.redirect(new URL(`${base}/account`, req.nextUrl));
  }

  const payment = await withDbRetry(
    () => prisma.payment.findFirst({ where: { id: state.paymentId, familyId: state.familyId } }),
    { operation: 'payment-return-read' },
  );
  if (!payment) return NextResponse.redirect(new URL(`${base}/account`, req.nextUrl));

  const outcome = await finalizePayment(payment.id);

  if (payment.kind === 'enrollment') {
    const url = new URL(`${base}/enroll`, req.nextUrl);
    if (outcome === 'paid') url.searchParams.set('paid', String(payment.id));
    else if (outcome === 'pending') url.searchParams.set('paypending', String(payment.id));
    else url.searchParams.set('payfail', '1');
    const res = NextResponse.redirect(url);
    // Clear the cart only when the payment actually went through — and only
    // for the family that owns it (cookie is session-scoped anyway).
    const familyId = await getFamilyId().catch(() => null);
    if (outcome === 'paid' && familyId === payment.familyId) {
      res.cookies.set(CART_COOKIE, '', { path: '/', maxAge: 0 });
    }
    return res;
  }

  // renewal → back to the portal
  const url = new URL(`${base}/portal`, req.nextUrl);
  if (outcome === 'paid') url.searchParams.set('paid', '1');
  else if (outcome === 'pending') url.searchParams.set('paypending', '1');
  else url.searchParams.set('payfail', '1');
  return NextResponse.redirect(url);
}
