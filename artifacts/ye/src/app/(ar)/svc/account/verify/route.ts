import { NextRequest, NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/db';
import { FAMILY_COOKIE, FAMILY_COOKIE_OPTIONS, familyToken, normalizeSaudiPhone, toAsciiDigits } from '@/lib/family-auth';
import { verifyOtp, verifyOtpInTx, type OtpVerifyResult } from '@/lib/otp';

export const dynamic = 'force-dynamic';

/**
 * Step 2 — verify the OTP. Creates the family on first login
 * (parentName required for new accounts) and sets the session cookie.
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const phone = normalizeSaudiPhone(String(body.phone ?? ''));
  const code = toAsciiDigits(String(body.code ?? '').trim());
  if (!phone || !/^\d{6}$/.test(code)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  let family = await withDbRetry(
    () => prisma.family.findUnique({ where: { phone } }),
    { operation: 'login-family-read' },
  );
  const parentName = String(body.parentName ?? '').trim();

  // New family without a name yet: check the code WITHOUT consuming it, so
  // the client can ask for the parent name and resubmit the same code.
  if (!family && !parentName) {
    const peek = await verifyOtp(phone, code, { consume: false });
    if (peek !== 'ok') {
      const status = peek === 'too_many_attempts' ? 429 : 401;
      return NextResponse.json({ error: peek }, { status });
    }
    return NextResponse.json({ needName: true });
  }
  if (!family && parentName.length > 80) {
    return NextResponse.json({ error: 'parent_name_required' }, { status: 400 });
  }

  let result: OtpVerifyResult = 'invalid';
  const locale = body.locale === 'en' ? 'en' : 'ar';
  const authenticated = await withDbRetry(() => prisma.$transaction(async (tx) => {
    const currentFamily = await tx.family.findUnique({ where: { phone } });
    const verified = await verifyOtpInTx(tx, phone, code);
    if (verified !== 'ok') return { result: verified, family: currentFamily };
    const resolvedFamily =
      currentFamily ??
      await tx.family.create({ data: { phone, parentName, locale } });
    return { result: verified, family: resolvedFamily };
  }), { operation: 'login-verify-and-family', kind: 'transaction' });
  result = authenticated.result;
  family = authenticated.family;
  if (result !== 'ok') {
    const status = result === 'too_many_attempts' ? 429 : 401;
    return NextResponse.json({ error: result }, { status });
  }

  if (!family) return NextResponse.json({ error: 'login_failed' }, { status: 503 });

  const res = NextResponse.json({ id: family.id, parentName: family.parentName });
  res.cookies.set(FAMILY_COOKIE, familyToken(family.id), FAMILY_COOKIE_OPTIONS);
  return res;
}
