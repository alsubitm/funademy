import { createHmac, timingSafeEqual } from 'crypto';

const RETURN_STATE_TTL_MS = 24 * 60 * 60_000;

function signingSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SESSION_SECRET must be set in production');
  }
  return 'ye-dev-secret';
}

function signature(payload: string): string {
  return createHmac('sha256', signingSecret()).update(payload).digest('base64url');
}

/** Signed capability passed through hosted payment pages. It authorizes only
 * provider re-verification for one payment; it contains no provider secret. */
export function createPaymentReturnState(
  paymentId: number,
  familyId: number,
  now = Date.now(),
): string {
  if (!Number.isInteger(paymentId) || paymentId <= 0 || !Number.isInteger(familyId) || familyId <= 0) {
    throw new Error('invalid_payment_return_state_subject');
  }
  const payload = `v1.${paymentId}.${familyId}.${now + RETURN_STATE_TTL_MS}`;
  return `${payload}.${signature(payload)}`;
}

export function verifyPaymentReturnState(
  state: string | null,
  now = Date.now(),
): { paymentId: number; familyId: number } | null {
  if (!state || state.length > 256) return null;
  const parts = state.split('.');
  if (parts.length !== 5 || parts[0] !== 'v1') return null;
  const paymentId = Number(parts[1]);
  const familyId = Number(parts[2]);
  const expiresAt = Number(parts[3]);
  if (
    !Number.isInteger(paymentId) ||
    paymentId <= 0 ||
    !Number.isInteger(familyId) ||
    familyId <= 0 ||
    !Number.isFinite(expiresAt) ||
    expiresAt <= now
  ) return null;

  const payload = parts.slice(0, 4).join('.');
  const actual = Buffer.from(parts[4]);
  const expected = Buffer.from(signature(payload));
  if (actual.length !== expected.length) return null;
  return timingSafeEqual(actual, expected) ? { paymentId, familyId } : null;
}