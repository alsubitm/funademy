import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/db';
import { allowRate } from '@/lib/rate-limit';
import { INSTRUCTOR_COOKIE, instructorCookieOptions, instructorToken, safeInstructorMutation, verifyInstructorPassword } from '@/lib/instructor-auth';

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status });
export async function POST(req: Request) {
  if (!safeInstructorMutation(req)) return error('forbidden', 403);
  try {
    const body = await req.json();
    if (typeof body.email !== 'string' || typeof body.password !== 'string' || body.email.length > 254 || body.password.length > 128) return error('invalid_credentials', 401);
    const email = body.email.trim().toLowerCase();
    const digest = createHash('sha256').update(email).digest('hex');
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';
    if (!await allowRate(`instructor-ip:${ip}`, 30, 15 * 60 * 1000) ||
        !await allowRate(`instructor-login:${digest}`, 10, 15 * 60 * 1000)) return error('too_many_attempts', 429);
    const record = await prisma.instructor.findUnique({ where: { email } });
    // Same costly derivation for unknown/disabled users to avoid simple timing enumeration.
    const dummy = `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`;
    const matches = await verifyInstructorPassword(body.password, record?.passwordHash || dummy);
    if (!record?.active || !matches) return error('invalid_credentials', 401);
    const response = NextResponse.json({ ok: true });
    response.cookies.set(INSTRUCTOR_COOKIE, instructorToken(record.id, record.authVersion), instructorCookieOptions);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch { return error('service_unavailable', 503); }
}
export async function DELETE(req: Request) {
  if (!safeInstructorMutation(req)) return error('forbidden', 403);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(INSTRUCTOR_COOKIE, '', { ...instructorCookieOptions, maxAge: 0 });
  return response;
}
