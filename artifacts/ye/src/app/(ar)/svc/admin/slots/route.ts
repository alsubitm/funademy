import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const slots = await prisma.scheduleSlot.findMany({
    include: { program: true },
    orderBy: [{ weekday: 'asc' }, { time: 'asc' }],
  });
  return NextResponse.json({ slots });
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const programId = Number(b?.programId);
  const weekday = Number(b?.weekday);
  const time = String(b?.time ?? '');
  const format = String(b?.format ?? '');
  const capacity = Number(b?.capacity ?? 12);
  const location = b?.location ? String(b.location) : null;
  if (
    !programId ||
    !(weekday >= 0 && weekday <= 6) ||
    !/^\d{2}:\d{2}$/.test(time) ||
    !['online', 'in_person'].includes(format) ||
    !(capacity > 0 && capacity <= 100)
  ) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  const slot = await prisma.scheduleSlot.create({
    data: { programId, weekday, time, format: format as 'online' | 'in_person', capacity, seatsLeft: capacity, location },
  });
  return NextResponse.json({ slot }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!id) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const data: Record<string, unknown> = {};
  if (b.time !== undefined && /^\d{2}:\d{2}$/.test(String(b.time))) data.time = String(b.time);
  if (b.weekday !== undefined && b.weekday >= 0 && b.weekday <= 6) data.weekday = Number(b.weekday);
  if (b.seatsLeft !== undefined && b.seatsLeft >= 0) data.seatsLeft = Number(b.seatsLeft);
  if (b.capacity !== undefined && b.capacity > 0) data.capacity = Number(b.capacity);
  if (b.active !== undefined) data.active = Boolean(b.active);
  if (b.location !== undefined) data.location = b.location ? String(b.location) : null;
  const slot = await prisma.scheduleSlot.update({ where: { id }, data });
  return NextResponse.json({ slot });
}

export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const id = Number(req.nextUrl.searchParams.get('id'));
  if (!id) return NextResponse.json({ error: 'validation' }, { status: 400 });
  const hasBookings = await prisma.booking.count({ where: { slotId: id } });
  if (hasBookings > 0) {
    // keep history — deactivate instead of delete
    await prisma.scheduleSlot.update({ where: { id }, data: { active: false } });
    return NextResponse.json({ deactivated: true });
  }
  await prisma.scheduleSlot.delete({ where: { id } });
  return NextResponse.json({ deleted: true });
}
