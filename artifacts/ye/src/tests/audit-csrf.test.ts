import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { isSafeApiMutation } from '@/middleware';

describe('API browser origin boundary', () => {
  const request = (headers: Record<string, string>, path = '/svc/enroll/checkout') =>
    new NextRequest(`https://funademy.io${path}`, { method: 'POST', headers });
  it('allows same-origin requests through the trusted proxy host', () => {
    expect(isSafeApiMutation(request({ origin: 'https://funademy.io', 'x-forwarded-host': 'funademy.io' }))).toBe(true);
  });
  it('rejects cross-site and same-site sibling origins', () => {
    expect(isSafeApiMutation(request({ 'sec-fetch-site': 'cross-site' }))).toBe(false);
    expect(isSafeApiMutation(request({ origin: 'https://other.funademy.io' }))).toBe(false);
    expect(isSafeApiMutation(request({ origin: 'null' }))).toBe(false);
  });
  it('leaves provider signature verification to webhook handlers', () => {
    expect(isSafeApiMutation(request({ origin: 'https://provider.example' }, '/svc/pay/webhook/moyasar'))).toBe(true);
  });
});
