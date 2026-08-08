import { createHmac, timingSafeEqual } from 'crypto';
import { cookies } from 'next/headers';

const IS_PROD = process.env.NODE_ENV === 'production';

function getSecret(): string {
  const v = process.env.SESSION_SECRET;
  if (v) return v;
  if (IS_PROD) throw new Error('SESSION_SECRET must be set in production');
  return 'ye-dev-secret';
}

export const FAMILY_COOKIE = 'ye_family';
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export const FAMILY_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: IS_PROD,
  maxAge: SESSION_TTL_MS / 1000,
};

const sign = (value: string) => createHmac('sha256', getSecret()).update(value).digest('hex');

/** Token format: family.<familyId>.<expiryEpochMs>.<hmac> */
export function familyToken(familyId: number): string {
  const payload = `family.${familyId}.${Date.now() + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function familyIdFromToken(token: string | undefined): number | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const [subject, idStr, expiryStr] = payload.split('.');
  if (subject !== 'family') return null;
  const id = Number(idStr);
  const expiry = Number(expiryStr);
  if (!Number.isInteger(id) || id <= 0) return null;
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return id;
}

/** Returns the authenticated family id, or null. */
export async function getFamilyId(): Promise<number | null> {
  const store = await cookies();
  return familyIdFromToken(store.get(FAMILY_COOKIE)?.value);
}

/** Convert Arabic-Indic (٠-٩) and Eastern Arabic-Indic (۰-۹) digits to ASCII. */
export function toAsciiDigits(raw: string): string {
  return raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/** Normalize a Saudi mobile number to +9665XXXXXXXX; null if invalid. */
export function normalizeSaudiPhone(raw: string): string | null {
  const digits = toAsciiDigits(raw).replace(/[\s\-()]/g, '');
  const m = digits.match(/^(?:\+?966|0)?(5\d{8})$/);
  return m ? `+966${m[1]}` : null;
}
