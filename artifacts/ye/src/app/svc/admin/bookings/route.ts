import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const bookings = await prisma.booking.findMany({
    include: { program: true, slot: true },
    orderBy: { createdAt: 'desc' },
  });

  if (req.nextUrl.searchParams.get('format') === 'csv') {
    const header = 'id,created_at,parent_name,phone,child_first_name,child_birth_year,neighborhood,program,weekday,time,format,status';
    const esc = (v: unknown) => `"${String(v).replace(/"/g, '""')}"`;
    const rows = bookings.map((b) =>
      [
        b.id,
        b.createdAt.toISOString(),
        esc(b.parentName),
        esc(b.phone),
        esc(b.childFirstName),
        b.childBirthYear,
        b.neighborhood,
        esc(b.program.nameEn),
        b.slot.weekday,
        b.slot.time,
        b.slot.format,
        b.status,
      ].join(','),
    );
    return new NextResponse([header, ...rows].join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ye-bookings.csv"',
      },
    });
  }

  return NextResponse.json({ bookings });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const status = String(b?.status ?? '');
  if (!id || !['new', 'contacted', 'enrolled'].includes(status)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  const booking = await prisma.booking.update({
    where: { id },
    data: { status: status as 'new' | 'contacted' | 'enrolled' },
  });
  return NextResponse.json({ booking });
}
