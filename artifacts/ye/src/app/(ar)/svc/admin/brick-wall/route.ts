import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

/** GET ?status=pending|approved|rejected (default pending) — Watanona brick moderation queue. */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const status = req.nextUrl.searchParams.get('status') ?? 'pending';
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  const bricks = await prisma.watanBrick.findMany({
    where: { status: status as 'pending' | 'approved' | 'rejected' },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  const counts = await prisma.watanBrick.groupBy({ by: ['status'], _count: true });
  return NextResponse.json({
    bricks,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count])),
  });
}

/** PATCH { id, status: "approved" | "rejected" } */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const status = String(b?.status ?? '');
  if (!Number.isInteger(id) || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  try {
    const brick = await prisma.watanBrick.update({ where: { id }, data: { status: status as 'approved' | 'rejected' } });
    return NextResponse.json({ brick });
  } catch {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
}
