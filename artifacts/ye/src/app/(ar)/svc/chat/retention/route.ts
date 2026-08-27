import { NextRequest, NextResponse } from 'next/server';
import { purgeExpiredChat } from '@/lib/chat-retention';

export const dynamic = 'force-dynamic';

// This endpoint has no user data response and can only delete already-expired
// chat rows. It is deliberately scheduler-safe without a shared secret.
export async function POST(req: NextRequest) {
  const cron = req.headers.get('x-vercel-cron') || req.headers.get('x-replit-scheduled');
  if (!cron && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'scheduler_required' }, { status: 403 });
  }
  const result = await purgeExpiredChat(100);
  return NextResponse.json(result);
}