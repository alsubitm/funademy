import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { processDueTrialCommunications } from '@/lib/trial-communications';

export const dynamic = 'force-dynamic';

const validInternalSecret = (value: string | null) => {
  const expected = process.env.SESSION_SECRET;
  if (!expected || !value) return false;
  try {
    return timingSafeEqual(Buffer.from(value), Buffer.from(expected));
  } catch {
    return false;
  }
};

/** Local, server-only trigger used by the instrumentation timer. */
export async function POST(req: NextRequest) {
  if (!validInternalSecret(req.headers.get('x-internal-sweep'))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  return NextResponse.json(await processDueTrialCommunications());
}