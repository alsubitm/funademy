import { NextResponse } from 'next/server';
import { getSmsHealth } from '@/lib/smsHealth';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

/** Admin-only SMS health: Authentica balance + recent delivery failures. */
export async function GET() {
  const guard = await requireAdmin();
  if (guard) return guard;
  return NextResponse.json(await getSmsHealth());
}
