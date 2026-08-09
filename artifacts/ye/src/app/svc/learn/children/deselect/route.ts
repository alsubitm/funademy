import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { KID_COOKIE } from '@/lib/kid-auth';

export const dynamic = 'force-dynamic';

export async function POST() {
  const store = await cookies();
  store.delete(KID_COOKIE);
  return NextResponse.json({ ok: true });
}
