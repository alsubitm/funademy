import { NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/auth';

export async function requireAdmin(): Promise<NextResponse | null> {
  if (await isAdminRequest()) return null;
  return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
}
