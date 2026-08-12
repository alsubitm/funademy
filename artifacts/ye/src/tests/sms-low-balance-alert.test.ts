/**
 * Out-of-band low-SMS-balance admin alert (src/lib/smsBalanceAlert.ts).
 *
 * When the Authentica balance drops under the threshold, exactly ONE alert
 * SMS goes to the admin per 24h; no fake sends without a provider, and a
 * failing balance fetch or alert send can never break the OTP/login flow.
 * Global fetch is mocked; runs against the isolated ye_test database.
 */
import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';

import { prisma } from '@/lib/db';
import { clearSmsBalanceCache } from '@/lib/smsHealth';
import {
  maybeSendLowBalanceAlert,
  ALERT_KEY,
  ALERT_COOLDOWN_MS,
} from '@/lib/smsBalanceAlert';
import { requestOtp } from '@/lib/otp';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const json200 = (body: unknown) => ({
  ok: true,
  status: 200,
  json: async () => body,
  text: async () => '',
});

const usedPhones: string[] = [];
function freshPhone(): string {
  const p = `+9665${String(Math.floor(10000000 + Math.random() * 89999999))}`;
  usedPhones.push(p);
  return p;
}

/** fetch mock: balance endpoint → given SAR, send-otp endpoint → success. */
function mockProvider(balanceSar: number, sendOk = true) {
  fetchMock.mockImplementation(async (url: string) => {
    if (String(url).includes('/balance')) return json200({ balance: balanceSar });
    if (sendOk) return json200({ success: true });
    return { ok: false, status: 500, json: async () => ({}), text: async () => '' };
  });
}

const sendCalls = () =>
  fetchMock.mock.calls.filter(([u]) => String(u).includes('send-otp'));

beforeEach(async () => {
  await prisma.adminAlert.deleteMany({ where: { key: ALERT_KEY } });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  clearSmsBalanceCache();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.adminAlert.deleteMany({ where: { key: ALERT_KEY } });
  await prisma.otpCode.deleteMany({ where: { phone: { in: usedPhones } } });
});

describe('maybeSendLowBalanceAlert', () => {
  it('makes no calls at all when the provider is not configured', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', '');
    expect(await maybeSendLowBalanceAlert()).toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not alert when the balance is at/above the threshold', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    mockProvider(50);
    expect(await maybeSendLowBalanceAlert()).toBe('skipped');
    expect(sendCalls()).toHaveLength(0);
  });

  it('sends exactly one alert when low, to the admin phone, with the balance as payload', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    vi.stubEnv('ADMIN_ALERT_PHONE', '+966500000001');
    mockProvider(12.7);
    expect(await maybeSendLowBalanceAlert()).toBe('sent');
    const calls = sendCalls();
    expect(calls).toHaveLength(1);
    const body = JSON.parse((calls[0][1] as RequestInit).body as string);
    expect(body.phone).toBe('+966500000001');
    expect(body.otp).toBe('12');
    const row = await prisma.adminAlert.findUnique({ where: { key: ALERT_KEY } });
    expect(row).not.toBeNull();
  });

  it('deduplicates: a second low check within 24h sends nothing', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    mockProvider(5);
    expect(await maybeSendLowBalanceAlert()).toBe('sent');
    expect(await maybeSendLowBalanceAlert()).toBe('skipped');
    expect(sendCalls()).toHaveLength(1);
  });

  it('alerts again once the cooldown has elapsed', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    mockProvider(5);
    await prisma.adminAlert.create({
      data: { key: ALERT_KEY, sentAt: new Date(Date.now() - ALERT_COOLDOWN_MS - 60_000) },
    });
    expect(await maybeSendLowBalanceAlert()).toBe('sent');
    expect(sendCalls()).toHaveLength(1);
  });

  it('concurrent checks send at most one alert (atomic DB claim)', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    mockProvider(5);
    // Warm the balance cache so all racers see "low" without racing fetch.
    await maybeSendLowBalanceAlert();
    fetchMock.mockClear();
    await prisma.adminAlert.deleteMany({ where: { key: ALERT_KEY } });
    const results = await Promise.all(
      Array.from({ length: 6 }, () => maybeSendLowBalanceAlert()),
    );
    expect(results.filter((r) => r === 'sent')).toHaveLength(1);
    expect(sendCalls()).toHaveLength(1);
  });

  it('a claimed-but-failed send does not retry until cooldown (no paid retry storm)', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    mockProvider(5, false);
    expect(await maybeSendLowBalanceAlert()).toBe('send_failed');
    expect(await maybeSendLowBalanceAlert()).toBe('skipped');
    expect(sendCalls()).toHaveLength(1);
  });

  it('a provider error on balance fetch is skipped, never thrown', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockRejectedValue(new Error('network down'));
    expect(await maybeSendLowBalanceAlert()).toBe('skipped');
  });
});

describe('OTP flow integration', () => {
  it('requestOtp succeeds and login is unaffected even when the balance check explodes', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    // send-otp works; balance endpoint hard-fails.
    fetchMock.mockImplementation(async (url: string) => {
      if (String(url).includes('/balance')) throw new Error('balance down');
      return json200({ success: true });
    });
    const res = await requestOtp(freshPhone());
    expect(res.ok).toBe(true);
    // Give the fire-and-forget alert check a tick to run (and not throw).
    await new Promise((r) => setTimeout(r, 50));
  });

  it('requestOtp triggers the low-balance alert out of band', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    mockProvider(3);
    const res = await requestOtp(freshPhone());
    expect(res.ok).toBe(true);
    await vi.waitFor(async () => {
      const row = await prisma.adminAlert.findUnique({ where: { key: ALERT_KEY } });
      expect(row).not.toBeNull();
    });
  });
});
