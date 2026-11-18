import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPayment, refundPayment, sarMinorUnits, verifyPayment } from '@/lib/payments';

const expected = { amountSar: 1380, currency: 'SAR' };
const money = (amount: number, currency = 'SAR') => ({ amount, currency });
const order = (status: string, captured: number, currency = 'SAR') => ({
  status, total_amount: money(1380, currency), captured_amount: money(captured, currency),
  refunded_amount: money(0, currency),
});
function tamara(data: unknown) {
  vi.stubEnv('TAMARA_API_TOKEN', 'synthetic-test-token');
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(data)));
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('audit: settlement requires the entire authoritative order', () => {
  it('converts decimal amounts to halalas without accepting excess precision', () => {
    expect(sarMinorUnits('1380.10')).toBe(138010);
    expect(sarMinorUnits(0.29)).toBe(29);
    for (const value of [NaN, Infinity, -1, '0.001', '1e5', null, {}]) expect(sarMinorUnits(value)).toBeNull();
  });
  it.each([
    ['partially_captured', 100, 'SAR', 'pending'],
    ['fully_captured', 100, 'SAR', 'pending'],
    ['fully_captured', 1380, 'USD', 'pending'],
    ['fully_captured', 1380, 'SAR', 'paid'],
    ['fully_captured', 1381, 'SAR', 'pending'],
  ])('Tamara %s with %s %s returns %s', async (status, amount, currency, result) => {
    tamara(order(status, amount as number, currency));
    expect(await verifyPayment('tamara', 'synthetic-order', expected)).toBe(result);
  });
  it('does not accept missing captured/refunded fields', async () => {
    tamara({ status: 'fully_captured', total_amount: money(1380) });
    expect(await verifyPayment('tamara', 'synthetic-order', expected)).toBe('pending');
  });
  it.each(['authorised', 'partially_captured', 'fully_captured'])('rechecks capture 409 against %s', async status => {
    vi.stubEnv('TAMARA_API_TOKEN', 'synthetic-test-token');
    const fetch = vi.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify(order('authorised', 0))))
      .mockResolvedValueOnce(new Response('{}', { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(order(status, status === 'fully_captured' ? 1380 : 100))));
    expect(await verifyPayment('tamara', 'synthetic-order', expected)).toBe(status === 'fully_captured' ? 'paid' : 'pending');
    expect(fetch).toHaveBeenCalledTimes(3);
  });
  it.each([
    ['paid', 138000, 0, 'SAR', 'paid'],
    ['authorized', 138000, 0, 'SAR', 'pending'],
    ['captured', 138000, 10000, 'SAR', 'pending'],
    ['captured', 138000, 138000, 'SAR', 'paid'],
    ['paid', 10000, 0, 'SAR', 'pending'],
    ['paid', 138000, 0, 'USD', 'pending'],
  ])('Moyasar checks %s amount %s captured %s currency %s', async (status, amount, captured, currency, result) => {
    vi.stubEnv('MOYASAR_SECRET_KEY', 'synthetic-test-key');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({
      status: 'paid', amount: 138000, currency: 'SAR',
      payments: [{ status, amount, captured, currency, refunded: 0 }],
    })));
    expect(await verifyPayment('moyasar_mada', 'synthetic-invoice', expected)).toBe(result);
  });
  it('rejects simulation in production without the Replit flag', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('REPLIT_DEPLOYMENT', '');
    vi.stubEnv('PAYMENT_SANDBOX', '1');
    const fetch = vi.spyOn(globalThis, 'fetch');
    expect((await createPayment('tamara', 1380, 'Synthetic')).status).toBe('failed');
    expect(await verifyPayment('tamara', 'SIM-test', expected)).toBe('pending');
    expect((await refundPayment('tamara', 'SIM-test', 1380)).ok).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });
});
