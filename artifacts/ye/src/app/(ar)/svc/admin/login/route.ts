import { timingSafeEqual, createHash } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ADMIN_COOKIE, ADMIN_COOKIE_OPTIONS, getAdminPassword, adminToken } from '@/lib/auth';
import { allowRate, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60_000;

function safeEqual(a: string, b: string): boolean {
  // Hash both sides so lengths are equal, then compare in constant time.
  const ha = createHash('sha256').update(a).digest();
  const hb = createHash('sha256').update(b).digest();
  return timingSafeEqual(ha, hb);
}

export async function POST(req: NextRequest) {
  let password = '';
  try {
    const b = await req.json();
    password = String(b.password ?? '');
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const ok = await allowRate(`admin-login:${clientIp(req)}`, MAX_ATTEMPTS, WINDOW_MS);
  if (!ok) {
    return NextResponse.json({ error: 'too_many_attempts' }, { status: 429 });
  }
  if (!safeEqual(password, getAdminPassword())) {
    return NextResponse.json({ error: 'wrong_password' }, { status: 401 });
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, adminToken(), ADMIN_COOKIE_OPTIONS);
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
  return res;
}
