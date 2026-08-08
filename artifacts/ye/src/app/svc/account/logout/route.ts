import { NextResponse } from 'next/server';
import { FAMILY_COOKIE } from '@/lib/family-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(FAMILY_COOKIE, '', { path: '/', maxAge: 0 });
  return res;
}
