import { afterAll, describe, expect, it } from 'vitest';
import { prisma } from '@/lib/db';
import { requestOtp, verifyOtp } from '@/lib/otp';

// Never deliver messages: setup-env removes the SMS provider key.
const phones = Array.from({ length: 4 }, (_, i) => `audit-otp-${Date.now()}-${i}`);
async function issue(phone: string) {
  const result = await requestOtp(phone);
  if (!result.ok || !result.devCode) throw new Error('Expected isolated OTP test delivery');
  return result.devCode;
}
afterAll(async () => {
  await prisma.otpCode.deleteMany({ where: { phone: { in: phones } } });
  await prisma.$disconnect();
});
describe('audit: single-current OTP and atomic consumption', () => {
  it('invalidates A on issue B and never resurrects A after consuming B', async () => {
    const a = await issue(phones[0]);
    const b = await issue(phones[0]);
    expect(await prisma.otpCode.count({ where: { phone: phones[0], consumed: false } })).toBe(1);
    if (a !== b) expect(await verifyOtp(phones[0], a)).toBe('invalid');
    expect(await verifyOtp(phones[0], b)).toBe('ok');
    expect(await verifyOtp(phones[0], a)).toBe('invalid');
  });
  it('allows exactly one simultaneous consumption', async () => {
    const code = await issue(phones[1]);
    const results = await Promise.all(Array.from({ length: 8 }, () => verifyOtp(phones[1], code)));
    expect(results.filter(x => x === 'ok')).toHaveLength(1);
  });
  it('preserves expiry and non-consuming registration checks', async () => {
    const code = await issue(phones[2]);
    expect(await verifyOtp(phones[2], code, { consume: false })).toBe('ok');
    await prisma.otpCode.updateMany({ where: { phone: phones[2] }, data: { expiresAt: new Date(0) } });
    expect(await verifyOtp(phones[2], code)).toBe('expired');
  });
  it('serializes wrong attempts and preserves the resend quota', async () => {
    const code = await issue(phones[3]);
    await Promise.all(Array.from({ length: 7 }, () => verifyOtp(phones[3], '000000')));
    expect(await verifyOtp(phones[3], code)).toBe('too_many_attempts');
    for (let i = 0; i < 4; i++) await issue(phones[3]);
    expect(await requestOtp(phones[3])).toEqual({ ok: false, error: 'rate_limited' });
  });
});
