import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const b = body as Record<string, unknown>;

  const programId = Number(b.programId);
  const slotId = Number(b.slotId);
  const parentName = String(b.parentName ?? '').trim();
  const phone = String(b.phone ?? '').trim();
  const childFirstName = String(b.childFirstName ?? '').trim();
  const childBirthYear = Number(b.childBirthYear);
  const neighborhood = String(b.neighborhood ?? '').trim();

  const currentYear = new Date().getFullYear();
  if (
    !programId ||
    !slotId ||
    !parentName ||
    !childFirstName ||
    !/^(\+?966|0)?5\d{8}$/.test(phone.replace(/[\s-]/g, '')) ||
    !(childBirthYear >= currentYear - 19 && childBirthYear <= currentYear - 3)
  ) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const outcome = await prisma.$transaction(async (tx) => {
    // Validity + seat decrement inside the transaction to avoid races with
    // concurrent bookings or admin deactivation.
    const updated = await tx.scheduleSlot.updateMany({
      where: { id: slotId, programId, active: true, seatsLeft: { gt: 0 } },
      data: { seatsLeft: { decrement: 1 } },
    });
    if (updated.count === 0) {
      const slot = await tx.scheduleSlot.findUnique({ where: { id: slotId } });
      if (!slot || slot.programId !== programId || !slot.active) return 'slot_not_found' as const;
      return 'slot_full' as const;
    }
    return tx.booking.create({
      data: { programId, slotId, parentName, phone, childFirstName, childBirthYear, neighborhood },
    });
  });

  if (outcome === 'slot_not_found') return NextResponse.json({ error: 'slot_not_found' }, { status: 404 });
  if (outcome === 'slot_full') return NextResponse.json({ error: 'slot_full' }, { status: 409 });
  return NextResponse.json({ id: outcome.id }, { status: 201 });
}
