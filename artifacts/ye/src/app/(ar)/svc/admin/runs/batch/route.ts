import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { revalidatePrograms } from '@/lib/revalidate-programs';
import { requireAdmin } from '../../guard';
import { isHttpUrl, isValidTime, weeklyDates } from '@/lib/course-run-schedule';

export const dynamic = 'force-dynamic';

const MAX_GROUPS = 100;

/**
 * POST — create a whole timetable of course runs at once (e.g. a term's online
 * groups). Shared settings apply to every group; each group picks its own
 * program, weekday and time.
 *
 * {
 *   format: 'online' | 'in_person', capacity, monthlyPriceSar, kitFeeSar?,
 *   startDate, endDate, titleAr?, titleEn?, location?, meetingUrl?,
 *   groups: [{ programId, weekday, time }]
 * }
 *
 * All-or-nothing (one transaction). Idempotent for retries: a group that
 * already exists with the same program, format, weekday, time and start date
 * is skipped, not duplicated. In-person groups without a venue are created
 * INACTIVE (hidden from parents) until the admin adds the venue and switches
 * them on — the site refuses in-person enrollment without a confirmed venue.
 */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const format = String(b?.format ?? '');
  const capacity = Number(b?.capacity);
  const monthlyPriceSar = Number(b?.monthlyPriceSar ?? 1380);
  const kitFeeSar = Number(b?.kitFeeSar ?? 0);
  const startDate = new Date(String(b?.startDate ?? ''));
  const endDate = new Date(String(b?.endDate ?? ''));
  const groups: unknown[] = Array.isArray(b?.groups) ? b.groups : [];

  if (
    !['in_person', 'online'].includes(format) ||
    !(Number.isInteger(capacity) && capacity >= 1 && capacity <= 100) ||
    !(Number.isInteger(monthlyPriceSar) && monthlyPriceSar >= 0) ||
    !(Number.isInteger(kitFeeSar) && kitFeeSar >= 0 && kitFeeSar <= 10000) ||
    isNaN(startDate.getTime()) || isNaN(endDate.getTime()) || endDate < startDate ||
    groups.length < 1 || groups.length > MAX_GROUPS
  ) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  const parsed = groups.map((g) => {
    const o = (g && typeof g === 'object' ? g : {}) as Record<string, unknown>;
    return { programId: Number(o.programId), weekday: Number(o.weekday), time: String(o.time ?? '') };
  });
  const invalid = parsed.findIndex((g) =>
    !Number.isInteger(g.programId) || !Number.isInteger(g.weekday) || g.weekday < 0 || g.weekday > 6 || !isValidTime(g.time));
  if (invalid >= 0) return NextResponse.json({ error: 'validation', group: invalid }, { status: 400 });

  // The same program can't be booked twice at the same weekday + time in one request.
  const keys = new Set(parsed.map((g) => `${g.programId}:${g.weekday}:${g.time}`));
  if (keys.size !== parsed.length) return NextResponse.json({ error: 'duplicate_group' }, { status: 400 });

  const meetingUrl = format === 'online' && b?.meetingUrl ? String(b.meetingUrl).slice(0, 500) : null;
  if (meetingUrl && !isHttpUrl(meetingUrl)) return NextResponse.json({ error: 'bad_url' }, { status: 400 });
  const location = format === 'in_person' && b?.location ? String(b.location).slice(0, 120).trim() || null : null;

  const programIds = [...new Set(parsed.map((g) => g.programId))];
  const known = await prisma.program.findMany({ where: { id: { in: programIds } }, select: { id: true } });
  if (known.length !== programIds.length) return NextResponse.json({ error: 'program_not_found' }, { status: 404 });

  const schedules = parsed.map((g) => ({ ...g, dates: weeklyDates(startDate, endDate, g.weekday, g.time) }));
  if (schedules.some((s) => s.dates.length === 0)) return NextResponse.json({ error: 'no_sessions_in_range' }, { status: 400 });

  // In-person groups stay hidden until a real venue is set (enrollment needs one).
  const active = format === 'online' || Boolean(location && !/^(riyadh|الرياض)$/i.test(location));
  const titleAr = b?.titleAr ? String(b.titleAr).slice(0, 80) : null;
  const titleEn = b?.titleEn ? String(b.titleEn).slice(0, 80) : null;

  const result = await prisma.$transaction(async (tx) => {
    const created: number[] = [];
    let skipped = 0;
    for (const s of schedules) {
      const existing = await tx.courseRun.findFirst({
        where: { programId: s.programId, format: format as 'in_person' | 'online', weekday: s.weekday, time: s.time, startDate },
        select: { id: true },
      });
      if (existing) { skipped++; continue; }
      const run = await tx.courseRun.create({
        data: {
          programId: s.programId, titleAr, titleEn, startDate, endDate, weekday: s.weekday, time: s.time,
          format: format as 'in_person' | 'online', location, capacity, seatsLeft: capacity, monthlyPriceSar,
          kitFeeSar: format === 'online' ? kitFeeSar : 0, meetingUrl, active,
          sessions: { createMany: { data: s.dates.map((date) => ({ date })) } },
        },
        select: { id: true },
      });
      created.push(run.id);
    }
    return { created, skipped };
  }, { timeout: 60_000 });

  if (result.created.length) revalidatePrograms();
  return NextResponse.json({ created: result.created.length, skipped: result.skipped, runIds: result.created, active }, { status: 201 });
}
