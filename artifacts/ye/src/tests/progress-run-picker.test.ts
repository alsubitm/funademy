import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

vi.mock('@/app/(ar)/svc/admin/guard', () => ({ requireAdmin: vi.fn(async () => null) }));
import { requireAdmin } from '@/app/(ar)/svc/admin/guard';
import { GET as runsGET } from '@/app/(ar)/svc/admin/runs/route';
import { GET as rosterGET } from '@/app/(ar)/svc/admin/roster/route';

const tag = `picker-${Date.now()}`;
let programId: number;
let familyId: number;
let oldestId: number;
let inactiveId: number;
const runIds: number[] = [];

async function options(query: Record<string, string>) {
  const res = await runsGET(new NextRequest(`http://test.local/svc/admin/runs?${new URLSearchParams({ options: '1', ...query })}`));
  return { status: res.status, body: await res.json() };
}

beforeAll(async () => {
  programId = (await prisma.program.create({ data: {
    slug: tag, kitCode: 'KIT-01', nameEn: tag, nameAr: `برنامج ${tag}`, ageMin: 4, ageMax: 14,
    format: 'online', color: '#123456', level: 1, taglineEn: '', taglineAr: '',
    descEn: '', descAr: '', buildsEn: [], buildsAr: [], termsEn: [], termsAr: [],
  } })).id;
  const base = { programId, startDate: new Date('2025-01-01'), endDate: new Date('2025-03-01'), weekday: 1, time: '17:00', format: 'online' as const };
  oldestId = (await prisma.courseRun.create({ data: { ...base, titleAr: `أقدم دفعة ${tag}` } })).id;
  runIds.push(oldestId);
  inactiveId = (await prisma.courseRun.create({ data: { ...base, titleAr: `متوقفة ${tag}`, active: false } })).id;
  for (let i = 0; i < 45; i++) runIds.push((await prisma.courseRun.create({ data: { ...base, titleAr: `دفعة ${i}` } })).id);
  const family = await prisma.family.create({ data: { phone: tag, parentName: tag, students: { create: { firstName: 'سارة', birthYear: 2017 } } }, include: { students: true } });
  familyId = family.id;
  await prisma.enrollment.create({ data: { studentId: family.students[0].id, courseRunId: oldestId, status: 'active' } });
});

afterAll(async () => {
  if (familyId) {
    await prisma.enrollment.deleteMany({ where: { student: { familyId } } });
    await prisma.family.delete({ where: { id: familyId } });
  }
  if (programId) {
    await prisma.courseRun.deleteMany({ where: { programId } });
    await prisma.program.delete({ where: { id: programId } });
  }
});

describe('progress run selector options', () => {
  it('requires an administrator', async () => {
    vi.mocked(requireAdmin).mockResolvedValueOnce(NextResponse.json({}, { status: 401 }));
    expect((await options({ rq: tag })).status).toBe(401);
  });

  it('returns bounded pages of selector fields only', async () => {
    const { status, body } = await options({ rq: tag });
    expect(status).toBe(200);
    expect(body.runs).toHaveLength(20);
    expect(body.nextCursor).toBeTruthy();
    expect(Object.keys(body.runs[0]).sort()).toEqual(['id', 'program', 'startDate', 'time', 'titleAr']);
    expect(body.runs[0].program).toEqual({ id: programId, nameAr: `برنامج ${tag}` });
    expect(body.runs.map((r: any) => r.id)).not.toContain(oldestId);
  });

  it('finds an older run beyond the first page by paging, by text search and by #id', async () => {
    const seen: number[] = [];
    let cursor: string | null = null;
    do {
      const { body }: { body: any } = await options({ rq: tag, ...(cursor ? { cursor } : {}) });
      seen.push(...body.runs.map((r: any) => r.id));
      cursor = body.nextCursor;
    } while (cursor);
    expect(seen).toEqual([...runIds].sort((a, b) => b - a)); // no skips/duplicates, inactive excluded
    expect(seen.at(-1)).toBe(oldestId);

    const search = await options({ rq: `أقدم دفعة ${tag}` });
    expect(search.body.runs.map((r: any) => r.id)).toEqual([oldestId]);
    const byId = await options({ rq: `#${oldestId}` });
    expect(byId.body.runs.map((r: any) => r.id)).toContain(oldestId);
    expect((await options({ rq: `#${inactiveId}` })).body.runs.map((r: any) => r.id)).not.toContain(inactiveId);
    expect((await options({ rq: `متوقفة ${tag}` })).body.runs).toEqual([]);
  });

  it('hands the found run identity to the roster', async () => {
    const run = (await options({ rq: `#${oldestId}` })).body.runs.find((r: any) => r.id === oldestId);
    const res = await rosterGET(new NextRequest(`http://test.local/svc/admin/roster?runId=${run.id}`));
    const { roster } = await res.json();
    expect(roster.map((r: any) => r.student.firstName)).toEqual(['سارة']);
  });

  it.each<Record<string, string>>([{ cursor: 'prev:5' }, { cursor: 'oops' }, { limit: '101' }, { rq: 'x'.repeat(201) }])('rejects %o', async (q) => {
    expect((await options(q)).status).toBe(400);
  });
});
