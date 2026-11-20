import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { listPage, bookingFilter, runFilter } from '@/lib/admin-list-query';

vi.mock('@/app/(ar)/svc/admin/guard', () => ({ requireAdmin: vi.fn(async () => null) }));
import { requireAdmin } from '@/app/(ar)/svc/admin/guard';
import { GET as bookingsGET, PATCH as bookingsPATCH } from '@/app/(ar)/svc/admin/bookings/route';
import { GET as runsGET, PATCH as runsPATCH } from '@/app/(ar)/svc/admin/runs/route';

const tag = `paging-${Date.now()}`;
let programId: number;
let slotId: number;
let familyId: number;
let bookingIds: number[] = [];
let runIds: number[] = [];
const sameDate = new Date('2027-01-01T00:00:00Z');

async function booking(overrides = {}) {
  return prisma.booking.create({ data: {
    programId, slotId, parentName: tag, phone: '+966500000000',
    childFirstName: 'طفل', childBirthYear: 2018, neighborhood: 'riyadh',
    createdAt: sameDate, ...overrides,
  } });
}
async function run(overrides = {}) {
  return prisma.courseRun.create({ data: {
    programId, titleAr: 'دفعة', startDate: sameDate, endDate: new Date('2027-03-01'),
    weekday: 1, time: '17:00', format: 'online', ...overrides,
  } });
}
async function list(kind: 'bookings' | 'runs', extra: Record<string, string> = {}) {
  const prefix = kind === 'bookings' ? 'b' : 'r';
  const query = new URLSearchParams({ [`${prefix}program`]: String(programId), limit: '2', ...extra });
  const response = await (kind === 'bookings' ? bookingsGET : runsGET)(
    new NextRequest(`http://test.local/svc/admin/${kind}?${query}`),
  );
  expect(response.status).toBe(200);
  return response.json();
}
const ids = (data: any, kind: string) => data[kind].map((row: any) => row.id);

beforeAll(async () => {
  const program = await prisma.program.create({ data: {
    slug: tag, kitCode: 'KIT-01', nameEn: tag, nameAr: `برنامج ${tag}`, ageMin: 4, ageMax: 14,
    format: 'online', color: '#123456', level: 1, taglineEn: '', taglineAr: '',
    descEn: '', descAr: '', buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
  } });
  programId = program.id;
  slotId = (await prisma.scheduleSlot.create({ data: {
    programId, weekday: 1, time: '17:00', format: 'online', capacity: 12, seatsLeft: 12,
  } })).id;
  for (let i = 0; i < 6; i++) {
    bookingIds.push((await booking({
      childFirstName: i === 0 ? 'حرف%_خاص' : `طفل ${i}`, status: i === 1 ? 'contacted' : 'new',
      assignedTo: i === 0 ? '' : 'قبول', trialAttendance: i === 2 ? 'present' : 'pending',
    })).id);
    runIds.push((await run({
      titleAr: `دفعة ${i}`, location: i === 0 ? 'حرف%_خاص' : 'الرياض',
      active: i !== 1, seatsLeft: i === 2 ? 0 : 12,
    })).id);
  }
  const family = await prisma.family.create({ data: { phone: tag, parentName: tag } });
  familyId = family.id;
  await prisma.payment.create({ data: {
    familyId, kind: 'enrollment', provider: 'test', reference: tag, status: 'paid', subtotalSar: 1, totalSar: 1,
    items: { create: {
      trialBookingId: bookingIds[2], studentName: tag, programAr: tag, programEn: tag,
      periodStart: sameDate, periodEnd: sameDate, baseSar: 1, discountPct: 0, totalSar: 1,
    } },
  } });
});
afterAll(async () => {
  if (familyId) await prisma.family.delete({ where: { id: familyId } });
  if (programId) {
    await prisma.appointment.deleteMany({ where: { bookingId: { in: bookingIds } } });
    await prisma.booking.deleteMany({ where: { programId } });
    await prisma.program.delete({ where: { id: programId } });
  }
});

describe('authenticated server-side admin lists', () => {
  it('rejects anonymous JSON, CSV and selector reads before database access', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await bookingsGET(new NextRequest('http://test.local/svc/admin/bookings'))).status).toBe(401);
    vi.mocked(requireAdmin).mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await bookingsGET(new NextRequest('http://test.local/svc/admin/bookings?format=csv'))).status).toBe(401);
    vi.mocked(requireAdmin).mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await runsGET(new NextRequest('http://test.local/svc/admin/runs'))).status).toBe(401);
    vi.mocked(requireAdmin).mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await runsGET(new NextRequest('http://test.local/svc/admin/runs?options=1'))).status).toBe(401);
  });

  it('filters bookings in SQL, excludes paid conversions from legacy statuses and retains global metrics/options', async () => {
    const all = await list('bookings');
    expect(all.bookings).toHaveLength(2);
    expect(all.pagination.matching).toBe(6);
    expect(all.pagination.total).toBe(await prisma.booking.count());
    expect(all.programs.some((p: any) => p.id === programId)).toBe(true);
    const converted = await list('bookings', { bstatus: 'converted' });
    expect(ids(converted, 'bookings')).toEqual([bookingIds[2]]);
    expect((await list('bookings', { bstatus: 'new' })).pagination.matching).toBe(4);
    expect(ids(await list('bookings', { bstatus: 'contacted' }), 'bookings')).toEqual([bookingIds[1]]);
    expect(ids(await list('bookings', { bowner: 'unassigned' }), 'bookings')).toEqual([bookingIds[0]]);
    expect((await list('bookings', { bowner: 'assigned' })).pagination.matching).toBe(5);
    expect(ids(await list('bookings', { bq: '%_' }), 'bookings')).toEqual([bookingIds[0]]);
    expect((await list('bookings', { bq: tag.toUpperCase() })).pagination.matching).toBe(6);
    expect(converted.metrics).toEqual(all.metrics);
    expect(all.metrics.enrolled).toBe(await prisma.booking.count({ where: { conversionItem: { is: { payment: { status: 'paid' } } } } }));
    expect((await list('bookings', { bq: 'no match' })).pagination.matching).toBe(0);
    expect((await list('bookings', { bq: 'no match' })).programs).toEqual(all.programs);
  });

  it('filters runs by program, state, seats and literal search, including combined filters', async () => {
    expect((await list('runs')).pagination.matching).toBe(6);
    expect(ids(await list('runs', { rstate: 'inactive' }), 'runs')).toEqual([runIds[1]]);
    expect(ids(await list('runs', { rseats: 'full' }), 'runs')).toEqual([runIds[2]]);
    expect((await list('runs', { rstate: 'active', rseats: 'available' })).pagination.matching).toBe(4);
    expect(ids(await list('runs', { rq: '%_' }), 'runs')).toEqual([runIds[0]]);
    expect((await list('runs', { rq: '17:00' })).pagination.matching).toBe(6);
    expect((await list('runs', { rq: 'no match' })).pagination.matching).toBe(0);
    const options = await (await runsGET(new NextRequest('http://test.local/svc/admin/runs?options=1'))).json();
    expect(options.runs.filter((r: any) => runIds.includes(r.id))).toHaveLength(5);
  });

  it.each(['bookings', 'runs'] as const)('pages %s without skips or duplicates after insert, boundary deletion and sort-field edits', async (kind) => {
    const originalIds = kind === 'bookings' ? bookingIds : runIds;
    const first = await list(kind);
    expect(ids(first, kind)).toEqual(originalIds.slice(-2).reverse());
    expect(first.pagination.previousCursor).toBeNull();
    const boundaryId = originalIds[4];
    if (kind === 'bookings') {
      const created = await booking();
      bookingIds.push(created.id);
      await prisma.booking.delete({ where: { id: boundaryId } });
      await prisma.booking.update({ where: { id: originalIds[3] }, data: { trialStartsAt: new Date('2030-01-01') } });
    } else {
      runIds.push((await run()).id);
      await prisma.courseRun.delete({ where: { id: boundaryId } });
      await prisma.courseRun.update({ where: { id: originalIds[3] }, data: { startDate: new Date('2030-01-01'), active: false } });
    }
    const second = await list(kind, { cursor: first.pagination.nextCursor });
    expect(ids(second, kind)).toEqual([originalIds[3], originalIds[2]]);
    expect(second.pagination.matching).toBe(6); // insert and deletion cancel each other
    const back = await list(kind, { cursor: second.pagination.previousCursor });
    expect(ids(back, kind)).toEqual([originalIds.at(-1), originalIds[5]]);
    const third = await list(kind, { cursor: second.pagination.nextCursor });
    expect(ids(third, kind)).toEqual([originalIds[1], originalIds[0]]);
    expect(third.pagination.nextCursor).toBeNull();
    const exhausted = await list(kind, { cursor: `next:${originalIds[0]}` });
    expect(ids(exhausted, kind)).toEqual([]);
    expect(exhausted.pagination.previousCursor).toBeTruthy();
  });

  it('refreshes filter membership after booking and run mutations', async () => {
    expect((await bookingsPATCH(new NextRequest('http://test.local/svc/admin/bookings', {
      method: 'PATCH', body: JSON.stringify({ id: bookingIds[0], status: 'enrolled' }),
    }))).status).toBe(200);
    expect(ids(await list('bookings', { bstatus: 'enrolled' }), 'bookings')).toEqual([bookingIds[0]]);
    expect((await runsPATCH(new NextRequest('http://test.local/svc/admin/runs', {
      method: 'PATCH', body: JSON.stringify({ id: runIds[0], active: false }),
    }))).status).toBe(200);
    expect(ids(await list('runs', { rstate: 'active', rq: 'دفعة 0' }), 'runs')).toEqual([]);
  });

  it('exports every booking regardless of filters, limit and cursor', async () => {
    const response = await bookingsGET(new NextRequest(
      'http://test.local/svc/admin/bookings?format=csv&bq=no-match&bprogram=0&limit=1&cursor=broken',
    ));
    expect(response.status).toBe(200);
    const csv = await response.text();
    const count = await prisma.booking.count();
    expect(csv.split('\n')).toHaveLength(count + 1);
    expect(csv).toContain(tag);
  });
});

describe('query bounds', () => {
  it.each(['limit=0', 'limit=101', 'limit=1.5', 'cursor=next:0', 'cursor=next:9999999999', 'cursor=oops'])('rejects %s', (query) => {
    expect(() => listPage(new URLSearchParams(query))).toThrow();
  });
  it('rejects unknown filters, invalid program IDs and oversized text', () => {
    expect(() => bookingFilter(new URLSearchParams('bstatus=oops'))).toThrow();
    expect(() => runFilter(new URLSearchParams('rprogram=-1'))).toThrow();
    expect(() => runFilter(new URLSearchParams('rseats=oops'))).toThrow();
    expect(() => bookingFilter(new URLSearchParams({ bq: 'x'.repeat(201) }))).toThrow();
  });
  it('returns bad requests rather than throwing from the routes', async () => {
    expect((await bookingsGET(new NextRequest('http://test.local/svc/admin/bookings?limit=100000'))).status).toBe(400);
    expect((await runsGET(new NextRequest('http://test.local/svc/admin/runs?rstate=oops'))).status).toBe(400);
  });
});
