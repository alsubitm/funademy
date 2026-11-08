/**
 * Admin SMS health: Authentica balance (src/lib/smsAuthentica.ts
 * getAuthenticaBalance + src/lib/smsHealth.ts + /svc/admin/sms route).
 *
 * Family login depends on prepaid SMS credit — the dashboard must show the
 * real balance, warn when low, and fail honestly (never a fake number).
 * Global fetch is mocked; no real HTTP leaves the suite. Runs against the
 * isolated ye_test database.
 */
import { describe, it, expect, afterEach, afterAll, vi } from 'vitest';

// ——— mocked cookie store (next/headers) ———
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => cookieJar.set(name, value),
    delete: (name: string) => cookieJar.delete(name),
  }),
}));

import { prisma } from '@/lib/db';
import { adminToken, ADMIN_COOKIE } from '@/lib/auth';
import { getAuthenticaBalance } from '@/lib/smsAuthentica';
import { clearSmsBalanceCache, LOW_BALANCE_THRESHOLD_SAR } from '@/lib/smsHealth';
import { GET as smsGET } from '@/app/(ar)/svc/admin/sms/route';

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

const balance200 = (body: unknown) => ({
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

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllEnvs();
  cookieJar.clear();
  clearSmsBalanceCache();
});

afterAll(async () => {
  vi.unstubAllGlobals();
  await prisma.otpCode.deleteMany({ where: { phone: { in: usedPhones } } });
});

const asAdmin = () => cookieJar.set(ADMIN_COOKIE, adminToken());

describe('getAuthenticaBalance', () => {
  it('is not_configured without the API key and makes no HTTP call', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', '');
    expect(await getAuthenticaBalance()).toEqual({ ok: false, error: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('GETs the balance endpoint with the auth header and parses { balance }', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'test-key-123');
    fetchMock.mockResolvedValue(balance200({ balance: 91 }));
    expect(await getAuthenticaBalance()).toEqual({ ok: true, balanceSar: 91 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.authentica.sa/api/v2/balance');
    expect(init.method).toBe('GET');
    expect((init.headers as Record<string, string>)['X-Authorization']).toBe('test-key-123');
  });

  it('accepts a string balance and a data.balance wrapper', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValueOnce(balance200({ balance: '42.5' }));
    expect(await getAuthenticaBalance()).toEqual({ ok: true, balanceSar: 42.5 });
    fetchMock.mockResolvedValueOnce(balance200({ data: { balance: 7 } }));
    expect(await getAuthenticaBalance()).toEqual({ ok: true, balanceSar: 7 });
  });

  it('reports provider_error on HTTP failure and on unexpected shapes — never a number', async () => {
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}), text: async () => '' });
    expect(await getAuthenticaBalance()).toEqual({ ok: false, error: 'provider_error' });
    fetchMock.mockResolvedValueOnce(balance200({ unexpected: true }));
    expect(await getAuthenticaBalance()).toEqual({ ok: false, error: 'provider_error' });
    fetchMock.mockRejectedValueOnce(new Error('network down'));
    expect(await getAuthenticaBalance()).toEqual({ ok: false, error: 'provider_error' });
  });
});

describe('GET /svc/admin/sms', () => {
  it('requires admin', async () => {
    const res = await smsGET();
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the balance with a low flag below the threshold', async () => {
    asAdmin();
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValue(balance200({ balance: LOW_BALANCE_THRESHOLD_SAR - 1 }));
    const body = await (await smsGET()).json();
    expect(body.configured).toBe(true);
    expect(body.balanceSar).toBe(LOW_BALANCE_THRESHOLD_SAR - 1);
    expect(body.low).toBe(true);
    expect(body.balanceError).toBeNull();
  });

  it('caches the balance — a second request does not hit the provider', async () => {
    asAdmin();
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValue(balance200({ balance: 91 }));
    await smsGET();
    const body = await (await smsGET()).json();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(body.balanceSar).toBe(91);
    expect(body.low).toBe(false);
    expect(body.cachedAt).toBeTruthy();
  });

  it('reports provider failure honestly: balance null + error, not a stale/fake number', async () => {
    asAdmin();
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValue({ ok: false, status: 503, json: async () => ({}), text: async () => '' });
    const body = await (await smsGET()).json();
    expect(body.balanceSar).toBeNull();
    expect(body.low).toBe(false);
    expect(body.balanceError).toBe('provider_error');
  });

  it('reports not_configured without a key and never calls the provider', async () => {
    asAdmin();
    vi.stubEnv('AUTHENTICA_API_KEY', '');
    const body = await (await smsGET()).json();
    expect(body.configured).toBe(false);
    expect(body.balanceSar).toBeNull();
    expect(body.balanceError).toBe('not_configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('counts recent delivery outcomes from ye_otp_codes.delivered', async () => {
    asAdmin();
    vi.stubEnv('AUTHENTICA_API_KEY', 'k');
    fetchMock.mockResolvedValue(balance200({ balance: 91 }));
    // Other serial suites may leave recent OTP rows in the shared test DB.
    // Assert this fixture's contribution rather than assuming an empty table.
    const baseline = await (await smsGET()).json();
    const mk = (delivered: boolean | null, ageMs: number) =>
      prisma.otpCode.create({
        data: {
          phone: freshPhone(),
          codeHash: 'x',
          expiresAt: new Date(),
          delivered,
          createdAt: new Date(Date.now() - ageMs),
        },
      });
    await Promise.all([
      mk(false, 1000),
      mk(false, 2000),
      mk(true, 3000),
      mk(null, 4000), // dev/no-provider row — counted in neither bucket
      mk(false, 25 * 3600_000), // outside the 24h window
    ]);
    const body = await (await smsGET()).json();
    expect(body.failed24h - baseline.failed24h).toBe(2);
    expect(body.sent24h - baseline.sent24h).toBe(1);
  });
});
