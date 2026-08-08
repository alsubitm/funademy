import { createHmac, randomInt } from 'crypto';
import { prisma } from '@/lib/db';

/**
 * OTP flow for family login (phone verification).
 *
 * SMS INTEGRATION POINT
 * ---------------------
 * No SMS provider is wired up yet. `deliverOtp()` below is the single place
 * to integrate one (e.g. Unifonic, Taqnyat, or Twilio):
 *   - send `code` to `phone` via the provider's API
 *   - return true on success
 * Until then, production FAILS CLOSED (`sms_not_configured`) so codes are
 * never silently undeliverable. In development the code is returned in the
 * API response so the flow can be tested end to end; it is never logged.
 */

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_REQUESTS_PER_HOUR = 5;
const MAX_VERIFY_ATTEMPTS = 5;
const IS_PROD = process.env.NODE_ENV === 'production';

// Keyed HMAC (not a plain fast hash) so stored codes cannot be brute-forced
// offline without the server secret.
function otpSecret(): string {
  const v = process.env.SESSION_SECRET;
  if (v) return v;
  if (IS_PROD) throw new Error('SESSION_SECRET must be set in production');
  return 'ye-dev-secret';
}

const hashCode = (phone: string, code: string) =>
  createHmac('sha256', otpSecret()).update(`${phone}:${code}`).digest('hex');

async function deliverOtp(_phone: string, _code: string): Promise<boolean> {
  // ← SMS provider call goes here. Return true once delivery is wired up.
  return !IS_PROD;
}

export type OtpRequestResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: 'rate_limited' | 'sms_not_configured' };

export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const recent = await prisma.otpCode.count({ where: { phone, createdAt: { gte: hourAgo } } });
  if (recent >= MAX_REQUESTS_PER_HOUR) return { ok: false, error: 'rate_limited' };

  const code = String(randomInt(100000, 1000000));
  const delivered = await deliverOtp(phone, code);
  if (!delivered) return { ok: false, error: 'sms_not_configured' };

  await prisma.otpCode.create({
    data: { phone, codeHash: hashCode(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
  });
  return IS_PROD ? { ok: true } : { ok: true, devCode: code };
}

export type OtpVerifyResult = 'ok' | 'invalid' | 'expired' | 'too_many_attempts';

/**
 * Check the latest unconsumed code. With `consume: false` the code stays
 * usable (used to ask a new family for the parent name after a valid code,
 * without burning it).
 */
export async function verifyOtp(
  phone: string,
  code: string,
  opts: { consume: boolean } = { consume: true },
): Promise<OtpVerifyResult> {
  const record = await prisma.otpCode.findFirst({
    where: { phone, consumed: false },
    orderBy: { createdAt: 'desc' },
  });
  if (!record) return 'invalid';
  if (record.expiresAt < new Date()) return 'expired';
  if (record.attempts >= MAX_VERIFY_ATTEMPTS) return 'too_many_attempts';

  if (record.codeHash !== hashCode(phone, code)) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { attempts: { increment: 1 } } });
    return 'invalid';
  }
  if (opts.consume) {
    await prisma.otpCode.update({ where: { id: record.id }, data: { consumed: true } });
  }
  return 'ok';
}
