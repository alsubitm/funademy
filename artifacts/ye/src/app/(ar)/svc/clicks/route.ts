import { NextRequest, NextResponse } from 'next/server';
import { prisma, withDbRetry } from '@/lib/db';
import { riyadhDay } from '@/lib/constants';
import { allowRate, clientIp } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Track outbound clicks (e.g. WhatsApp). Fire-and-forget from the client. */
export async function POST(req: NextRequest) {
  let page: string;
  try {
    const b = await req.json();
    if (!b || b.kind !== 'whatsapp' || !['home', '/contact'].includes(b.page)) {
      return NextResponse.json({ error: 'validation' }, { status: 400 });
    }
    page = b.page;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  // A global ceiling also bounds limiter rows if callers rotate/spoof IPs.
  if (!(await allowRate('clicks:global', 600, 60_000)) ||
      !(await allowRate(`clicks:ip:${clientIp(req)}`, 30, 60_000))) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }
  const kind = 'whatsapp';
  const day = riyadhDay();
  try {
    await withDbRetry(
      () => prisma.clickEvent.upsert({
        where: { kind_page_day: { kind, page, day } },
        update: { count: { increment: 1 } },
        create: { kind, page, day, count: 1 },
      }),
      { operation: 'outbound-click-upsert', kind: 'transaction' },
    );
  } catch (error) {
    // Analytics must never block the outbound action it is observing.
    console.error('[clicks] analytics write skipped', error);
  }
  return NextResponse.json({ ok: true });
}
