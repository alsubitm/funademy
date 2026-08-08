import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

/** GET — all makeup requests, pending first then newest. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const requests = await prisma.makeupRequest.findMany({
    include: {
      student: { include: { family: { select: { parentName: true, phone: true } } } },
      session: { include: { courseRun: { include: { program: true } } } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  // MakeupStatus enum order is pending < approved < rejected, so 'asc' puts pending first.
  return NextResponse.json({ requests });
}

/** PATCH { id, status: 'approved'|'rejected', adminNote? } — decide a request. */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const status = String(b?.status ?? '');
  const adminNote = typeof b?.adminNote === 'string' ? b.adminNote.trim().slice(0, 300) : undefined;
  if (!Number.isInteger(id) || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const existing = await prisma.makeupRequest.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  const request = await prisma.makeupRequest.update({
    where: { id },
    data: {
      status: status as 'approved' | 'rejected',
      adminNote: adminNote === undefined ? existing.adminNote : adminNote || null,
      decidedAt: new Date(),
    },
  });
  return NextResponse.json({ request });
}
