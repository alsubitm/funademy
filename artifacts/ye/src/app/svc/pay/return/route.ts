import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getFamilyId } from '@/lib/family-auth';
import { finalizePayment } from '@/lib/pay-core';
import { CART_COOKIE } from '@/lib/cart';

export const dynamic = 'force-dynamic';

/**
 * Customer return URL after paying on the provider's hosted page.
 * The redirect query params are NEVER trusted — the payment is verified
 * against the provider API (pay-core.ts) before anything activates.
 */
export async function GET(req: NextRequest) {
  const paymentId = Number(req.nextUrl.searchParams.get('paymentId'));
  const lang = req.nextUrl.searchParams.get('lang') === 'en' ? 'en' : 'ar';
  const base = lang === 'en' ? '/en' : '';

  if (!Number.isInteger(paymentId)) {
    return NextResponse.redirect(new URL(`${base}/portal`, req.nextUrl));
  }

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) return NextResponse.redirect(new URL(`${base}/portal`, req.nextUrl));

  const outcome = await finalizePayment(paymentId);

  if (payment.kind === 'enrollment') {
    const url = new URL(`${base}/enroll`, req.nextUrl);
    if (outcome === 'paid') url.searchParams.set('paid', String(paymentId));
    else if (outcome === 'pending') url.searchParams.set('paypending', String(paymentId));
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
