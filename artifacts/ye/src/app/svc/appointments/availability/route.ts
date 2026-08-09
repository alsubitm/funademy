import { NextResponse } from 'next/server';
import { consultAvailability } from '@/lib/appointments';

export const dynamic = 'force-dynamic';

export async function GET() {
  const slots = await consultAvailability();
  return NextResponse.json({ slots });
}
