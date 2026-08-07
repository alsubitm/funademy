import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getBrickCount, resetBricks, setBricks } from '@/lib/bricks';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const [count, today] = await Promise.all([
    getBrickCount(),
    prisma.brickEvent.aggregate({
      _sum: { amount: true },
      where: { day: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date()) },
    }),
  ]);
  const clicks = await prisma.clickEvent.groupBy({
    by: ['kind'],
    _sum: { count: true },
  });
  return NextResponse.json({
    count,
    placedToday: today._sum.amount ?? 0,
    clicks: Object.fromEntries(clicks.map((c) => [c.kind, c._sum.count ?? 0])),
  });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => ({}));
  if (b?.action === 'reset') {
    await resetBricks();
  } else if (typeof b?.count === 'number' && b.count >= 0) {
    await setBricks(Math.floor(b.count));
  } else {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  return NextResponse.json({ count: await getBrickCount() });
}
