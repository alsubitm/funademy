import { createHmac, timingSafeEqual, scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { cookies } from 'next/headers';
import { prisma } from './db';

const scryptAsync = promisify(scrypt);

const IS_PROD = process.env.NODE_ENV === 'production';

function getSecret(): string {
  const v = process.env.SESSION_SECRET;
  if (v) return v;
  if (IS_PROD) throw new Error('SESSION_SECRET must be set in production');
  return 'ye-dev-secret';
}

export const KID_COOKIE = 'ye_kid';
const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours — shorter for kid safety

export const KID_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  secure: IS_PROD,
  maxAge: SESSION_TTL_MS / 1000,
};

const sign = (value: string) =>
  createHmac('sha256', getSecret()).update(value).digest('hex');

/** Token: kid.<familyId>.<childId>.<expiry>.<hmac> */
export function kidToken(familyId: number, childId: number): string {
  const payload = `kid.${familyId}.${childId}.${Date.now() + SESSION_TTL_MS}`;
  return `${payload}.${sign(payload)}`;
}

export function kidSessionFromToken(
  token: string | undefined,
): { familyId: number; childId: number } | null {
  if (!token) return null;
  const lastDot = token.lastIndexOf('.');
  if (lastDot <= 0) return null;
  const payload = token.slice(0, lastDot);
  const sig = token.slice(lastDot + 1);
  const parts = payload.split('.');
  if (parts.length !== 4 || parts[0] !== 'kid') return null;
  const familyId = Number(parts[1]);
  const childId = Number(parts[2]);
  const expiry = Number(parts[3]);
  if (!Number.isInteger(familyId) || familyId <= 0) return null;
  if (!Number.isInteger(childId) || childId <= 0) return null;
  if (!Number.isFinite(expiry) || Date.now() > expiry) return null;
  const expected = sign(payload);
  try {
    if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  } catch {
    return null;
  }
  return { familyId, childId };
}

export async function getKidSession(): Promise<{
  familyId: number;
  childId: number;
} | null> {
  const store = await cookies();
  return kidSessionFromToken(store.get(KID_COOKIE)?.value);
}

// ── PIN hashing (scrypt, same approach as Manara) ────────────────────────────

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derived = (await scryptAsync(pin, salt, 32)) as Buffer;
  return `${salt}:${derived.toString('hex')}`;
}

export async function verifyPin(
  pin: string,
  stored: string,
): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) {
    // legacy plaintext — direct compare
    return pin === stored;
  }
  const derived = (await scryptAsync(pin, salt, 32)) as Buffer;
  const hashBuf = Buffer.from(hash, 'hex');
  try {
    return timingSafeEqual(derived, hashBuf);
  } catch {
    return false;
  }
}

// ── Enrollment guard ──────────────────────────────────────────────────────────

/** Returns true if this family has at least one active enrollment */
export async function familyHasActiveEnrollment(
  familyId: number,
): Promise<boolean> {
  const count = await prisma.enrollment.count({
    where: {
      status: 'active',
      student: { familyId },
    },
  });
  return count > 0;
}
