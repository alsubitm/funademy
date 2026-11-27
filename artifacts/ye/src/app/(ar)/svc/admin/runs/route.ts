import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { revalidatePrograms } from '@/lib/revalidate-programs';
import { requireAdmin } from '../guard';
import { listPage, pageRows, runFilter } from '@/lib/admin-list-query';

export const dynamic = 'force-dynamic';

function isValidTime(t: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Generate weekly session dates. `time` is Riyadh local (UTC+3); stored as UTC — same convention as prisma/seed.ts. */
function weeklyDates(start: Date, end: Date, weekday: number, time: string): Date[] {
  const [h, m] = time.split(':').map(Number);
  const dates: Date[] = [];
  const d = new Date(start);
  // JS getUTCDay(): 0=Sunday — matches our weekday convention (date-only inputs parse as UTC midnight).
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  while (d <= end) {
    // store Riyadh local time as UTC (UTC+3, no DST)
    dates.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), (h ?? 17) - 3, m ?? 0)));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return dates;
}

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  // Progress selector: server-searched, keyset-paged active runs with selector fields only.
  // `rid` resolves one run by exact ID (e.g. "#123") so any older run stays reachable.
  if (req.nextUrl.searchParams.get('options') === '1') {
    const params = new URLSearchParams(req.nextUrl.searchParams);
    params.set('rstate', 'active');
    params.delete('rprogram'); params.delete('rseats');
    if (!params.has('limit')) params.set('limit', '20');
    let page;
    let where;
    try {
      page = listPage(params);
      if (page.direction !== 'next') throw new Error('invalid_cursor');
      const raw = (params.get('rq') ?? '').trim();
      const exactId = /^#?([1-9]\d{0,9})$/.exec(raw);
      where = runFilter(params);
      if (exactId && Number(exactId[1]) <= 2147483647) {
        where = { OR: [where, { active: true, id: Number(exactId[1]) }] };
      }
    } catch {
      return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
    }
    const rows = await prisma.courseRun.findMany({
      where: { AND: [where, { id: page.id }] },
      take: page.take + 1,
      select: {
        id: true, titleAr: true, time: true, startDate: true,
        program: { select: { id: true, nameAr: true } },
      },
      orderBy: { id: 'desc' },
    });
    const runs = rows.slice(0, page.take);
    return NextResponse.json({
      runs,
      nextCursor: rows.length > page.take ? `next:${runs.at(-1)!.id}` : null,
    });
  }
  let page;
  let where;
  try {
    page = listPage(req.nextUrl.searchParams);
    where = runFilter(req.nextUrl.searchParams);
  } catch {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.courseRun.findMany({
      where: { AND: [where, { id: page.id }] },
      take: page.take,
      include: {
        program: { select: { id: true, nameAr: true, color: true } },
        _count: { select: { sessions: true, enrollments: { where: { status: { in: ['active', 'pending'] } } } } },
      },
      orderBy: page.orderBy,
    });
    const runs = pageRows(rows, page);
    const [total, matching, previous, next] = await Promise.all([
      tx.courseRun.count(), tx.courseRun.count({ where }),
      tx.courseRun.findFirst({ where: { AND: [where, { id: { gt: runs[0]?.id ?? page.edge ?? 0 } }] }, select: { id: true } }),
      tx.courseRun.findFirst({ where: { AND: [where, { id: { lt: runs.at(-1)?.id ?? page.edge ?? 0 } }] }, select: { id: true } }),
    ]);
    return { runs, pagination: { total, matching,
      previousCursor: previous ? `prev:${runs[0]?.id ?? page.edge}` : null,
      nextCursor: next ? `next:${runs.at(-1)?.id ?? page.edge}` : null } };
  }, { isolationLevel: 'RepeatableRead' });
  return NextResponse.json(result);
}

/** Create a run and auto-generate its weekly ClassSessions. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const programId = Number(b?.programId);
  const weekday = Number(b?.weekday);
  const capacity = Number(b?.capacity);
  const monthlyPriceSar = Number(b?.monthlyPriceSar ?? 1380);
  const time = String(b?.time ?? '');
  const format = String(b?.format ?? '');
  const startDate = new Date(String(b?.startDate ?? ''));
  const endDate = new Date(String(b?.endDate ?? ''));

  if (
    !Number.isInteger(programId) ||
    !Number.isInteger(weekday) || !(weekday >= 0 && weekday <= 6) ||
    !isValidTime(time) ||
    !Number.isInteger(capacity) ||
    !['in_person', 'online'].includes(format) ||
    !(capacity >= 1 && capacity <= 100) ||
    !(monthlyPriceSar >= 0) ||
    isNaN(startDate.getTime()) ||
    isNaN(endDate.getTime()) ||
    endDate < startDate
  ) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  const meetingUrl = b?.meetingUrl ? String(b.meetingUrl).slice(0, 500) : null;
  if (meetingUrl && !isHttpUrl(meetingUrl)) return NextResponse.json({ error: 'bad_url' }, { status: 400 });

  const program = await prisma.program.findUnique({ where: { id: programId } });
  if (!program) return NextResponse.json({ error: 'program_not_found' }, { status: 404 });

  const dates = weeklyDates(startDate, endDate, weekday, time);
  if (dates.length === 0) return NextResponse.json({ error: 'no_sessions_in_range' }, { status: 400 });

  const run = await prisma.courseRun.create({
    data: {
      programId,
      titleAr: b?.titleAr ? String(b.titleAr).slice(0, 80) : null,
      titleEn: b?.titleEn ? String(b.titleEn).slice(0, 80) : null,
      startDate,
      endDate,
      weekday,
      time,
      format: format as 'in_person' | 'online',
      location: b?.location ? String(b.location).slice(0, 120) : null,
      capacity,
      seatsLeft: capacity,
      monthlyPriceSar,
      meetingUrl: format === 'online' ? meetingUrl : null,
      sessions: { createMany: { data: dates.map((date) => ({ date })) } },
    },
    include: { _count: { select: { sessions: true } } },
  });
  revalidatePrograms();
  return NextResponse.json({ run }, { status: 201 });
}

/** Edit basic fields or toggle active. Capacity edits adjust seatsLeft by the same delta. */
export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  if (!Number.isInteger(id)) return NextResponse.json({ error: 'validation' }, { status: 400 });

  const data: Record<string, unknown> = {};
  if (typeof b?.active === 'boolean') data.active = b.active;
  if (b?.titleAr !== undefined) data.titleAr = b.titleAr ? String(b.titleAr).slice(0, 80) : null;
  if (b?.location !== undefined) data.location = b.location ? String(b.location).slice(0, 120) : null;
  if (b?.meetingUrl !== undefined) {
    const url = b.meetingUrl ? String(b.meetingUrl).slice(0, 500) : null;
    if (url && !isHttpUrl(url)) return NextResponse.json({ error: 'bad_url' }, { status: 400 });
    data.meetingUrl = url;
  }
  if (b?.time !== undefined) {
    if (!isValidTime(String(b.time))) return NextResponse.json({ error: 'validation' }, { status: 400 });
    data.time = String(b.time);
  }
  if (b?.monthlyPriceSar !== undefined) {
    const p = Number(b.monthlyPriceSar);
    if (!(Number.isInteger(p) && p >= 0)) return NextResponse.json({ error: 'validation' }, { status: 400 });
    data.monthlyPriceSar = p;
  }

  let cap: number | null = null;
  if (b?.capacity !== undefined) {
    cap = Number(b.capacity);
    if (!(Number.isInteger(cap) && cap >= 1 && cap <= 100)) return NextResponse.json({ error: 'validation' }, { status: 400 });
  }

  try {
    // Capacity change must be transactional & conditional: a concurrent checkout
    // decrements seatsLeft atomically, so we only apply the new capacity if the
    // seat state we read is still current (otherwise 409 and the admin retries).
    const updated = await prisma.$transaction(async (tx) => {
      const run = await tx.courseRun.findUnique({ where: { id } });
      if (!run) throw new Error('not_found');
      if (cap !== null) {
        const taken = run.capacity - run.seatsLeft;
        if (cap < taken) throw new Error('capacity_below_enrolled');
        const res = await tx.courseRun.updateMany({
          where: { id, capacity: run.capacity, seatsLeft: run.seatsLeft },
          data: { ...data, capacity: cap, seatsLeft: cap - taken },
        });
        if (res.count === 0) throw new Error('conflict_retry');
        return tx.courseRun.findUniqueOrThrow({ where: { id } });
      }
      return tx.courseRun.update({ where: { id }, data });
    });
    revalidatePrograms();
    return NextResponse.json({ run: updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (msg === 'not_found') return NextResponse.json({ error: 'not_found' }, { status: 404 });
    if (msg === 'capacity_below_enrolled') return NextResponse.json({ error: 'capacity_below_enrolled' }, { status: 409 });
    if (msg === 'conflict_retry') return NextResponse.json({ error: 'conflict_retry' }, { status: 409 });
    throw e;
  }
}
