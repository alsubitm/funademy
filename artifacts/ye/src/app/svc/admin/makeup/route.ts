import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

/**
 * GET — all makeup requests, pending first then newest.
 * GET ?candidates=<requestId> — upcoming scheduled sessions the admin can book
 * as the makeup slot for that request (same program, future, active run,
 * excluding the missed session itself).
 */
export async function GET(req?: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const candidatesFor = req?.nextUrl.searchParams.get('candidates') ?? null;
  if (candidatesFor !== null) {
    const id = Number(candidatesFor);
    if (!Number.isInteger(id)) return NextResponse.json({ error: 'validation' }, { status: 400 });
    const request = await prisma.makeupRequest.findUnique({
      where: { id },
      include: { session: { include: { courseRun: true } } },
    });
    if (!request) return NextResponse.json({ error: 'not_found' }, { status: 404 });

    const sessions = await prisma.classSession.findMany({
      where: {
        id: { not: request.sessionId },
        status: 'scheduled',
        date: { gte: new Date() },
        courseRun: { active: true, programId: request.session.courseRun.programId },
      },
      include: { courseRun: { include: { program: { select: { nameAr: true, nameEn: true } } } } },
      orderBy: { date: 'asc' },
      take: 30,
    });
    return NextResponse.json({ sessions });
  }

  const requests = await prisma.makeupRequest.findMany({
    include: {
      student: { include: { family: { select: { parentName: true, phone: true } } } },
      session: { include: { courseRun: { include: { program: true } } } },
      makeupSession: { include: { courseRun: { select: { titleAr: true, titleEn: true, weekday: true, time: true, location: true, format: true } } } },
    },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
  });
  // MakeupStatus enum order is pending < approved < rejected, so 'asc' puts pending first.
  return NextResponse.json({ requests });
}

/**
 * PATCH { id, status: 'approved'|'rejected', adminNote?, makeupSessionId? } — decide a request.
 * Approval REQUIRES a valid makeup session: a future, still-scheduled session in an
 * active run of the same program, different from the missed session.
 */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const status = String(b?.status ?? '');
  const adminNote = typeof b?.adminNote === 'string' ? b.adminNote.trim().slice(0, 300) : undefined;
  const makeupSessionId = b?.makeupSessionId == null ? null : Number(b.makeupSessionId);
  if (!Number.isInteger(id) || !['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  if (makeupSessionId !== null && !Number.isInteger(makeupSessionId)) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const existing = await prisma.makeupRequest.findUnique({
    where: { id },
    include: { session: { include: { courseRun: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Approving without booking a concrete makeup session is not allowed —
  // the whole point of approval is that the child gets a real slot.
  let makeup: number | null = null;
  if (status === 'approved') {
    if (makeupSessionId === null) {
      return NextResponse.json({ error: 'makeup_session_required' }, { status: 400 });
    }
    if (makeupSessionId === existing.sessionId) {
      return NextResponse.json({ error: 'same_session' }, { status: 400 });
    }
    const target = await prisma.classSession.findUnique({
      where: { id: makeupSessionId },
      include: { courseRun: true },
    });
    if (!target) return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
    if (target.status !== 'scheduled') return NextResponse.json({ error: 'session_not_scheduled' }, { status: 409 });
    if (target.date < new Date()) return NextResponse.json({ error: 'session_in_past' }, { status: 409 });
    if (!target.courseRun.active) return NextResponse.json({ error: 'run_inactive' }, { status: 409 });
    if (target.courseRun.programId !== existing.session.courseRun.programId) {
      return NextResponse.json({ error: 'different_program' }, { status: 409 });
    }
    makeup = makeupSessionId;
  }

  const request = await prisma.makeupRequest.update({
    where: { id },
    data: {
      status: status as 'approved' | 'rejected',
      adminNote: adminNote === undefined ? existing.adminNote : adminNote || null,
      makeupSessionId: makeup,
      decidedAt: new Date(),
    },
  });
  return NextResponse.json({ request });
}
