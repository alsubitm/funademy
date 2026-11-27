import { NextRequest, NextResponse } from 'next/server';
import type { KitShipmentStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

const STATUSES: KitShipmentStatus[] = ['to_ship', 'shipped', 'delivered', 'returned', 'cancelled'];

/** GET ?status= — kit shipments for the admin panel (newest first). */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const status = req.nextUrl.searchParams.get('status');
  if (status && !STATUSES.includes(status as KitShipmentStatus)) {
    return NextResponse.json({ error: 'invalid_status' }, { status: 400 });
  }
  const [shipments, counts] = await Promise.all([
    prisma.kitShipment.findMany({
      where: status ? { status: status as KitShipmentStatus } : {},
      orderBy: [{ createdAt: 'desc' }],
      take: 300,
    }),
    prisma.kitShipment.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);
  return NextResponse.json({
    shipments,
    counts: Object.fromEntries(counts.map((c) => [c.status, c._count._all])),
  });
}

type Action = 'ship' | 'tracking' | 'deliver' | 'return' | 'cancel' | 'note';

/** Allowed source states per action; every update is conditional on them. */
const FROM: Record<Action, KitShipmentStatus[]> = {
  ship: ['to_ship'],
  tracking: ['shipped'],
  deliver: ['shipped'],
  // A returned kit makes its kit fee refundable (owner policy); refunds stay a separate admin step.
  return: ['shipped', 'delivered'],
  cancel: ['to_ship'],
  note: STATUSES,
};

/**
 * PATCH { id, action, trackingNumber?, note? }
 *  ship      to_ship → shipped   (SMSA tracking number required)
 *  tracking  fix the tracking number of a shipped kit
 *  deliver   shipped → delivered
 *  return    shipped|delivered → returned
 *  cancel    to_ship → cancelled (e.g. refunded before shipping)
 *  note      update the admin note only
 */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const action = String(b?.action ?? '') as Action;
  if (!Number.isInteger(id) || !(action in FROM)) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const note = b?.note === undefined ? undefined : String(b.note ?? '').trim().slice(0, 500) || null;
  const tracking = String(b?.trackingNumber ?? '').replace(/\s/g, '').toUpperCase();
  const now = new Date();
  const data: Prisma.KitShipmentUpdateManyMutationInput = note === undefined ? {} : { adminNote: note };

  if (action === 'ship' || action === 'tracking') {
    if (!/^[A-Z0-9-]{6,40}$/.test(tracking)) return NextResponse.json({ error: 'tracking_required' }, { status: 400 });
    data.trackingNumber = tracking;
    if (action === 'ship') Object.assign(data, { status: 'shipped', shippedAt: now });
  } else if (action === 'deliver') {
    Object.assign(data, { status: 'delivered', deliveredAt: now });
  } else if (action === 'return') {
    Object.assign(data, { status: 'returned', returnedAt: now });
  } else if (action === 'cancel') {
    data.status = 'cancelled';
  } else if (note === undefined) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const updated = await prisma.kitShipment.updateMany({ where: { id, status: { in: FROM[action] } }, data });
  if (updated.count === 0) {
    const exists = await prisma.kitShipment.findUnique({ where: { id }, select: { status: true } });
    return exists
      ? NextResponse.json({ error: 'invalid_transition', status: exists.status }, { status: 409 })
      : NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ shipment: await prisma.kitShipment.findUnique({ where: { id } }) });
}
