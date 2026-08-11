import { createHmac, randomInt } from 'crypto';
import { prisma } from '@/lib/db';
import { authenticaConfigured, sendOtpViaAuthentica } from '@/lib/smsAuthentica';

/**
 * OTP flow for family login (phone verification).
 *
 * SMS delivery is wired to Authentica (src/lib/smsAuthentica.ts) and goes
 * live purely by AUTHENTICA_API_KEY presence — in ANY environment. Codes
 * are still generated, stored (HMAC), rate-limited, and verified HERE;
 * Authentica only carries them (custom-OTP send).
 *
 * Without the key: production FAILS CLOSED (`sms_not_configured`) so codes
 * are never silently undeliverable, and development returns the code in the
 * API response (devCode) so the flow can be tested end to end; it is never
 * logged. Once the key is set, devCode is suppressed everywhere — the real
 * SMS is the only channel.
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

async function deliverOtp(phone: string, code: string): Promise<boolean> {
  if (authenticaConfigured()) return (await sendOtpViaAuthentica(phone, code)).ok;
  // No provider: dev "delivers" by echoing devCode; production fails closed.
  return !IS_PROD;
}

export type OtpRequestResult =
  | { ok: true; devCode?: string }
  | { ok: false; error: 'rate_limited' | 'sms_not_configured' | 'sms_send_failed' };

export async function requestOtp(phone: string): Promise<OtpRequestResult> {
  const configured = authenticaConfigured();
  const code = String(randomInt(100000, 1000000));

  // Count + insert are atomic per phone (advisory lock), so concurrent
  // requests cannot exceed the cap. The row is created BEFORE delivery, so
  // EVERY attempt — including failed sends — consumes the hourly quota:
  // provider calls are hard-capped at MAX_REQUESTS_PER_HOUR per phone.
  const created = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`otp:${phone}`}))`;
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await tx.otpCode.count({ where: { phone, createdAt: { gte: hourAgo } } });
    if (recent >= MAX_REQUESTS_PER_HOUR) return null;
    return tx.otpCode.create({
      data: { phone, codeHash: hashCode(phone, code), expiresAt: new Date(Date.now() + OTP_TTL_MS) },
    });
  });
  if (!created) return { ok: false, error: 'rate_limited' };

  // Deliver AFTER persisting: a provider timeout is an UNKNOWN outcome, not
  // proof of non-delivery — if the SMS still arrives late, its code must
  // verify. verifyOtp checks the latest unconsumed row, so after a retry
  // the newest SMS always wins (standard "use the latest code" UX).
  const delivered = await deliverOtp(phone, code);
  if (!delivered) {
    // Distinguish "provider down/rejected" (retryable) from "never set up".
    return { ok: false, error: configured ? 'sms_send_failed' : 'sms_not_configured' };
  }

  // devCode only while NO real channel exists: once a real SMS went out,
  // echoing the code in the API response would defeat the whole check.
  return !configured && !IS_PROD ? { ok: true, devCode: code } : { ok: true };
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
