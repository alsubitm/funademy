import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';

const derive = promisify(scrypt);
export const INSTRUCTOR_COOKIE = 'ye_instructor';
const TTL = 8 * 60 * 60;
export const instructorCookieOptions = {
  httpOnly: true, secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, path: '/', maxAge: TTL,
};
const signature = (value: string) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is required');
  return createHmac('sha256', secret).update(`instructor:${value}`).digest('hex');
};
export async function hashInstructorPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64) as Buffer;
  return `scrypt:${salt}:${hash.toString('hex')}`;
}
export async function verifyInstructorPassword(password: string, stored: string) {
  const [scheme, salt, hash] = stored.split(':');
  if (scheme !== 'scrypt' || !/^[a-f0-9]{32}$/.test(salt ?? '') || !/^[a-f0-9]{128}$/.test(hash ?? '')) return false;
  const actual = await derive(password, salt, 64) as Buffer;
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}
export function instructorToken(id: number, version: number) {
  const payload = `${id}.${version}.${Date.now() + TTL * 1000}`;
  return `${payload}.${signature(payload)}`;
}
export function parseInstructorToken(token: string | undefined) {
  if (!token || token.length > 200) return null;
  const parts = token.split('.');
  if (parts.length !== 4 || !parts.slice(0, 3).every(p => /^\d+$/.test(p)) || !/^[a-f0-9]{64}$/.test(parts[3])) return null;
  const [id, version, expires] = parts.slice(0, 3).map(Number);
  if (![id, version, expires].every(Number.isSafeInteger) || id <= 0 || version <= 0 || expires <= Date.now()) return null;
  const expected = signature(parts.slice(0, 3).join('.'));
  if (!timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts[3], 'hex'))) return null;
  return { id, version };
}
export async function currentInstructor() {
  const token = parseInstructorToken((await cookies()).get(INSTRUCTOR_COOKIE)?.value);
  if (!token) return null;
  const instructor = await prisma.instructor.findUnique({ where: { id: token.id } });
  return instructor?.active && instructor.authVersion === token.version ? instructor : null;
}

/** POST/PATCH/DELETE requests use JSON and same-origin fetch. Reject browser
 * cross-site requests even when a cookie could be attached. */
export function safeInstructorMutation(request: Request) {
  if (request.headers.get('sec-fetch-site') === 'cross-site') return false;
  const origin = request.headers.get('origin');
  if (origin) {
    try {
      const allowedHost = request.headers.get('x-forwarded-host')?.split(',')[0].trim() || request.headers.get('host') || new URL(request.url).host;
      if (new URL(origin).host !== allowedHost) return false;
    } catch { return false; }
  }
  return request.method === 'DELETE' || request.headers.get('content-type')?.split(';')[0].trim() === 'application/json';
}
