/**
 * Authentica SMS OTP delivery (src/lib/smsAuthentica.ts + src/lib/otp.ts).
 *
 * The provider goes live purely by AUTHENTICA_API_KEY presence; we generate
 * and verify our own codes — Authentica only carries them (custom-OTP send).
 * Runs against the isolated ye_test database. Global fetch is mocked; no
 * real HTTP ever leaves the suite.
 */
import { describe, it, expect, afterAll, afterEach, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { requestOtp, verifyOtp } from '@/lib/otp';
import { authenticaConfigured, sendOtpViaAuthentica } from '@/lib/smsAuthentica';
import { POST as otpPOST } from '@/app/(ar)/svc/account/otp/route';

const usedPhones: string[] = [];
/** Fresh normalized Saudi mobile (+9665XXXXXXXX), tracked for cleanup. */
function freshPhone(): string {
  const tail = String(Math.floor(10000000 + Math.random() * 89999999));
  const normalized = `+9665${tail}`;
  usedPhones.push(normalized);
  return normalized;
}

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const ok200 = () => ({
  ok: true,
  status: 200,
  text: async () => '',
  json: async () => ({ success: true }),
});
const fail = (status: number) => ({
  ok: false,
  status,
  text: async () => '',
  json: async () => ({ errors: [{ message: 'x' }] }),
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.otpCode.deleteMany({ where: { phone: { in: usedPhones } } });
  await prisma.family.deleteMany({ where: { phone: { in: usedPhones } } });
});

describe('sendOtpViaAuthentica', () => {
  it('is inactive without the API key and makes no HTTP call', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', '');
    expect(authenticaConfigured()).toBe(false);
    const r = await sendOtpViaAuthentica('+966512345678', '123456');
    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('POSTs our code with the documented shape and auth header', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'test-key-123');
    fetchMock.mockResolvedValue(ok200());
    const r = await sendOtpViaAuthentica('+966512345678', '654321');
    expect(r).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.authentica.sa/api/v2/send-otp');
    expect((init.headers as Record<string, string>)['X-Authorization']).toBe('test-key-123');
    expect(JSON.parse(String(init.body))).toEqual({
      method: 'sms',
      phone: '+966512345678',
      otp: '654321',
    });
  });

  it('supports whatsapp method and a numeric template id via env', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    vi.stubEnv('AUTHENTICA_OTP_METHOD', 'whatsapp');
    vi.stubEnv('AUTHENTICA_TEMPLATE_ID', '31');
    fetchMock.mockResolvedValue(ok200());
    await sendOtpViaAuthentica('+966512345678', '111222');
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.method).toBe('whatsapp');
    expect(body.template_id).toBe(31);
  });

  it('ignores a non-numeric template id', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    vi.stubEnv('AUTHENTICA_TEMPLATE_ID', 'abc');
    fetchMock.mockResolvedValue(ok200());
    await sendOtpViaAuthentica('+966512345678', '111222');
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect('template_id' in body).toBe(false);
  });

  it('reports failure on non-200 and on network errors without throwing', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValueOnce(fail(401));
    const r1 = await sendOtpViaAuthentica('+966512345678', '000001');
    expect(r1).toEqual({ ok: false, httpStatus: 401 });
    fetchMock.mockRejectedValueOnce(new Error('network boom'));
    const r2 = await sendOtpViaAuthentica('+966512345678', '000001');
    expect(r2.ok).toBe(false);
  });
});

describe('requestOtp with the provider', () => {
  it('unconfigured (dev): devCode returned, no HTTP call', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', '');
    const phone = freshPhone();
    const r = await requestOtp(phone);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.devCode).toMatch(/^\d{6}$/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('configured: real send, NO devCode, and the delivered code verifies', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValue(ok200());
    const phone = freshPhone();
    const r = await requestOtp(phone);
    // no devCode once a real SMS goes out — echoing it would defeat the check
    expect(r).toEqual({ ok: true });
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(sent.phone).toBe(phone);
    expect(sent.otp).toMatch(/^\d{6}$/);
    // round-trip integrity: what Authentica carried is what our DB verifies
    expect(await verifyOtp(phone, sent.otp)).toBe('ok');
  });

  it('provider failure: sms_send_failed, but the code is stored so a late-arriving SMS still verifies', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValue(fail(500));
    const phone = freshPhone();
    const r = await requestOtp(phone);
    expect(r).toEqual({ ok: false, error: 'sms_send_failed' });
    // A timeout/failure is an UNKNOWN outcome — the row must exist so that a
    // message that actually arrived can still be used.
    expect(await prisma.otpCode.count({ where: { phone } })).toBe(1);
    const sent = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(await verifyOtp(phone, sent.otp)).toBe('ok');
  });

  it('failed sends still consume the hourly cap — provider calls are bounded', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValue(fail(500));
    const phone = freshPhone();
    for (let i = 0; i < 5; i++) {
      expect(await requestOtp(phone)).toEqual({ ok: false, error: 'sms_send_failed' });
    }
    expect(await requestOtp(phone)).toEqual({ ok: false, error: 'rate_limited' });
    expect(fetchMock).toHaveBeenCalledTimes(5);
  });

  it('concurrent requests cannot exceed the cap (atomic per-phone lock)', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValue(ok200());
    const phone = freshPhone();
    const results = await Promise.all(Array.from({ length: 7 }, () => requestOtp(phone)));
    expect(results.filter((r) => r.ok).length).toBe(5);
    expect(results.filter((r) => !r.ok && r.error === 'rate_limited').length).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    expect(await prisma.otpCode.count({ where: { phone } })).toBe(5);
  });

  it('route maps sms_send_failed to HTTP 502', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValue(fail(503));
    const phone = freshPhone();
    const res = await otpPOST(
      new NextRequest('http://test.local/svc/account/otp', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      }),
    );
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe('sms_send_failed');
  });
});
