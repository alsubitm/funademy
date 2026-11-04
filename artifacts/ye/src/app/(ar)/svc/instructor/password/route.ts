import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { allowRate } from '@/lib/rate-limit';
import { currentInstructor, hashInstructorPassword, verifyInstructorPassword, safeInstructorMutation, INSTRUCTOR_COOKIE, instructorCookieOptions } from '@/lib/instructor-auth';

const reply = (error: string, status: number) =>
  NextResponse.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(req: Request) {
  // This credential-changing endpoint requires an explicit same-origin browser request.
  if (!req.headers.get('origin') || !safeInstructorMutation(req)) return reply('forbidden', 403);
  try {
    const origin = new URL(req.headers.get('origin')!);
    const protocol = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || new URL(req.url).protocol.slice(0, -1);
    if (origin.protocol !== `${protocol}:`) return reply('forbidden', 403);
    const instructor = await currentInstructor();
    if (!instructor) return reply('unauthorized', 401);
    // Account-scoped, durable quota cannot be bypassed by changing IP or session.
    if (!await allowRate(`instructor-password:${instructor.id}`, 5, 15 * 60 * 1000)) return reply('too_many_attempts', 429);
    let body;
    try { body = await req.json(); } catch { return reply('invalid_input', 400); }
    if (!body || typeof body.currentPassword !== 'string' || body.currentPassword.length < 1 || body.currentPassword.length > 128 ||
        typeof body.newPassword !== 'string' || body.newPassword.length < 12 || body.newPassword.length > 128 ||
        body.newPassword.trim().length < 12 || body.newPassword === body.currentPassword) return reply('invalid_password', 400);
    if (!await verifyInstructorPassword(body.currentPassword, instructor.passwordHash)) return reply('incorrect_password', 400);
    const passwordHash = await hashInstructorPassword(body.newPassword);
    // Compare-and-swap prevents an in-flight request overriding an admin reset,
    // disable, or another password change. Hash and revocation commit atomically.
    const result = await prisma.instructor.updateMany({
      where: { id: instructor.id, active: true, authVersion: instructor.authVersion, passwordHash: instructor.passwordHash },
      data: { passwordHash, authVersion: { increment: 1 } },
    });
    if (!result.count) return reply('unauthorized', 401);
    const response = NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
    response.cookies.set(INSTRUCTOR_COOKIE, '', { ...instructorCookieOptions, maxAge: 0 });
    return response;
  } catch { return reply('service_unavailable', 503); }
}
