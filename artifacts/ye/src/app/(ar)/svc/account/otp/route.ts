import { NextRequest, NextResponse } from 'next/server';
import { normalizeSaudiPhone } from '@/lib/family-auth';
import { requestOtp } from '@/lib/otp';

export const dynamic = 'force-dynamic';

/** Step 1 — request an OTP code for a Saudi phone number. */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const phone = normalizeSaudiPhone(String(body.phone ?? ''));
  if (!phone) return NextResponse.json({ error: 'invalid_phone' }, { status: 400 });

  const result = await requestOtp(phone);
  if (!result.ok) {
    const status = result.error === 'rate_limited' ? 429 : 503;
    return NextResponse.json({ error: result.error }, { status });
  }

  // Note: no account-existence hint here — whether the family is new is only
  // revealed after the OTP is verified (see /svc/account/verify).
  return NextResponse.json({
    sent: true,
    // Dev only — stripped in production (see src/lib/otp.ts integration point).
    ...(result.devCode ? { devCode: result.devCode } : {}),
  });
}
