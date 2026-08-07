import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const IS_PROD = process.env.NODE_ENV === 'production';

function requiredEnv(name: string, devFallback: string): string {
  const v = process.env[name];
  if (v) return v;
  if (IS_PROD) {
    throw new Error(`${name} must be set in production`);
  }
  return devFallback;
}

// Lazy so the check runs at request time, not during `next build`.
const getSecret = () => requiredEnv('SESSION_SECRET', 'ye-dev-secret');
export const getAdminPassword = () => requiredEnv('ADMIN_PASSWORD', 'YE-Riyadh-2026');

const COOKIE = 'ye_admin';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const sign = (value: string) =>
  createHmac('sha256', getSecret()).update(value).digest('hex');

/** Token format: admin.<expiryEpochMs>.<hmac(admin.<expiry>)> */
export function adminToken(): string {
  const payload = `admin.${Date.now() + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function isValidAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0) return false;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const [subject, expiryStr] = payload.split('.');
  if (subject !== 'admin') return false;
  const expiry = Number(expiryStr);
  if (!Number.isFinite(expiry) || Date.now() > expiry) return false;
  const expected = sign(payload);
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function isAdminRequest(): Promise<boolean> {
  const store = await cookies();
  return isValidAdminToken(store.get(COOKIE)?.value);
}

export const ADMIN_COOKIE = COOKIE;
export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: IS_PROD,
  maxAge: SESSION_TTL_MS / 1000,
};
