/**
 * Integration tests for the makeup-request flow:
 * parent requests a makeup for a missed session → admin approves/rejects →
 * the decision is visible to the family.
 *
 * Same structure as family-account.test.ts: runs against the isolated
 * ye_test database, calling the Next.js route handlers directly with a
 * mocked cookie store.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';

// ——— mocked cookie store (next/headers) ———
const cookieJar = new Map<string, string>();
vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: (name: string) =>
      cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined,
    set: (name: string, value: string) => {
      cookieJar.set(name, value);
    },
    delete: (name: string) => {
      cookieJar.delete(name);
    },
  }),
}));

import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { FAMILY_COOKIE, familyToken } from '@/lib/family-auth';
import { adminToken, ADMIN_COOKIE } from '@/lib/auth';
import { GET as accountGET, POST as accountPOST } from '@/app/svc/account/makeup/route';
import { GET as adminGET, PATCH as adminPATCH } from '@/app/svc/admin/makeup/route';

const RUN = `makeup-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const asFamily = (id: number | null) => {
  if (id === null) cookieJar.delete(FAMILY_COOKIE);
  else cookieJar.set(FAMILY_COOKIE, familyToken(id));
};
const asAdmin = (on: boolean) => {
  if (on) cookieJar.set(ADMIN_COOKIE, adminToken());
  else cookieJar.delete(ADMIN_COOKIE);
};

function jsonReq(url: string, method: string, body?: unknown) {
  return new NextRequest(`http://test.local${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? 'not json' : JSON.stringify(body),
  });
}

const requestMakeup = (body?: unknown) =>
  accountPOST(jsonReq('/svc/account/makeup', 'POST', body));
const decide = (body?: unknown) => adminPATCH(jsonReq('/svc/admin/makeup', 'PATCH', body));

// ——— fixtures ———
let programId: number;
let courseRunId: number;
let familyA: { id: number };
let familyB: { id: number };
let childA: { id: number }; // family A's child — absent from sessionMissed
let childA2: { id: number }; // family A's second child — present (never missed)
let childB: { id: number }; // family B's child
let sessionMissed: { id: number }; // childA absent
let sessionExcused: { id: number }; // childA excused
let sessionPresent: { id: number }; // childA present
let sessionUnmarked: { id: number }; // no attendance mark at all

beforeAll(async () => {
  const program = await prisma.program.create({
    data: {
      slug: `test-${RUN}`,
      kitCode: 'KIT-01',
      nameEn: `Test ${RUN}`,
      nameAr: 'اختبار',
      ageMin: 6,
      ageMax: 9,
      format: 'in_person',
      color: '#123456',
      level: 1,
      taglineEn: 't',
      taglineAr: 'ت',
      descEn: 'd',
      descAr: 'د',
      buildsEn: [],
      buildsAr: [],
      termsEn: [],
      termsAr: [],
    },
  });
  programId = program.id;
  const run = await prisma.courseRun.create({
    data: {
      programId,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-06-01'),
      weekday: 0,
      time: '17:00',
      format: 'in_person',
    },
  });
  courseRunId = run.id;

  familyA = await prisma.family.create({
    data: { phone: `+9665${String(Date.now()).slice(-8)}`, parentName: `أ ${RUN}` },
  });
  familyB = await prisma.family.create({
    data: { phone: `+9664${String(Date.now()).slice(-8)}`, parentName: `ب ${RUN}` },
  });
  childA = await prisma.student.create({
    data: { familyId: familyA.id, firstName: `غائب ${RUN}`, birthYear: 2017 },
  });
  childA2 = await prisma.student.create({
    data: { familyId: familyA.id, firstName: `حاضر ${RUN}`, birthYear: 2015 },
  });
  childB = await prisma.student.create({
    data: { familyId: familyB.id, firstName: `آخر ${RUN}`, birthYear: 2016 },
  });

  const mkSession = (date: string) =>
    prisma.classSession.create({ data: { courseRunId, date: new Date(date) } });
  sessionMissed = await mkSession('2026-02-01');
  sessionExcused = await mkSession('2026-02-08');
  sessionPresent = await mkSession('2026-02-15');
  sessionUnmarked = await mkSession('2026-02-22');

  await prisma.attendance.createMany({
    data: [
      { sessionId: sessionMissed.id, studentId: childA.id, status: 'absent' },
      { sessionId: sessionExcused.id, studentId: childA.id, status: 'excused' },
      { sessionId: sessionPresent.id, studentId: childA.id, status: 'present' },
      // childB is absent from sessionMissed too (used for the cross-family check)
      { sessionId: sessionMissed.id, studentId: childB.id, status: 'absent' },
    ],
  });
});

afterAll(async () => {
  cookieJar.clear();
  // Program cascade removes course run, sessions, attendance, makeup requests.
  await prisma.program.delete({ where: { id: programId } });
  await prisma.family.deleteMany({ where: { id: { in: [familyA.id, familyB.id] } } });
  await prisma.$disconnect();
});

describe('parent makeup request (POST /svc/account/makeup)', () => {
  it('requires a family session (401)', async () => {
    asFamily(null);
    const res = await requestMakeup({ studentId: 1, sessionId: 1 });
    expect(res.status).toBe(401);
    expect((await accountGET()).status).toBe(401);
  });

  it('rejects malformed input (400)', async () => {
    asFamily(familyA.id);
    expect((await requestMakeup()).status).toBe(400); // non-JSON body
    expect((await requestMakeup({ studentId: 'x', sessionId: 1 })).status).toBe(400);
    expect((await requestMakeup({ studentId: 1.5, sessionId: 2 })).status).toBe(400);
    expect((await requestMakeup({ sessionId: 2 })).status).toBe(400);
  });

  it("404 for another family's child, even though that child was absent", async () => {
    asFamily(familyA.id);
    const res = await requestMakeup({ studentId: childB.id, sessionId: sessionMissed.id });
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe('not_found');
    expect(
      await prisma.makeupRequest.findFirst({ where: { studentId: childB.id } }),
    ).toBeNull();
  });

  it('409 not_missed when the child was present or has no attendance mark', async () => {
    asFamily(familyA.id);
    const present = await requestMakeup({ studentId: childA.id, sessionId: sessionPresent.id });
    expect(present.status).toBe(409);
    expect((await present.json()).error).toBe('not_missed');

    const unmarked = await requestMakeup({ studentId: childA.id, sessionId: sessionUnmarked.id });
    expect(unmarked.status).toBe(409);
    expect((await unmarked.json()).error).toBe('not_missed');

    // another child of the same family with no mark at all
    const other = await requestMakeup({ studentId: childA2.id, sessionId: sessionMissed.id });
    expect(other.status).toBe(409);
  });

  it('creates a pending request for an actual absence, and 409 on duplicates', async () => {
    asFamily(familyA.id);
    const res = await requestMakeup({
      studentId: childA.id,
      sessionId: sessionMissed.id,
      note: `أرجو التعويض ${RUN}`,
    });
    expect(res.status).toBe(201);
    const { request } = await res.json();
    expect(request).toMatchObject({
      studentId: childA.id,
      sessionId: sessionMissed.id,
      status: 'pending',
      note: `أرجو التعويض ${RUN}`,
    });

    const dup = await requestMakeup({ studentId: childA.id, sessionId: sessionMissed.id });
    expect(dup.status).toBe(409);
    expect((await dup.json()).error).toBe('already_requested');
    expect(
      await prisma.makeupRequest.count({
        where: { studentId: childA.id, sessionId: sessionMissed.id },
      }),
    ).toBe(1);
  });

  it("an 'excused' mark also counts as missed", async () => {
    asFamily(familyA.id);
    const res = await requestMakeup({ studentId: childA.id, sessionId: sessionExcused.id });
    expect(res.status).toBe(201);
    expect((await res.json()).request.status).toBe('pending');
  });

  it('GET lists only the requests of the logged-in family', async () => {
    asFamily(familyA.id);
    const res = await accountGET();
    expect(res.status).toBe(200);
    const { requests } = await res.json();
    const ours = requests.filter((r: { student: { id: number } }) =>
      [childA.id, childA2.id].includes(r.student.id),
    );
    expect(ours.length).toBe(2);
    expect(requests.length).toBe(ours.length);

    asFamily(familyB.id);
    const other = await (await accountGET()).json();
    expect(
      other.requests.some((r: { student: { id: number } }) =>
        [childA.id, childA2.id].includes(r.student.id),
      ),
    ).toBe(false);
  });
});

describe('admin decision (PATCH /svc/admin/makeup)', () => {
  it('requires an admin session (401)', async () => {
    asAdmin(false);
    asFamily(familyA.id); // a family session must NOT grant admin access
    expect((await adminGET()).status).toBe(401);
    expect((await decide({ id: 1, status: 'approved' })).status).toBe(401);
    asFamily(null);
  });

  it('rejects malformed input (400) and unknown ids (404)', async () => {
    asAdmin(true);
    expect((await decide()).status).toBe(400); // non-JSON body
    expect((await decide({ id: 1, status: 'pending' })).status).toBe(400);
    expect((await decide({ id: 'x', status: 'approved' })).status).toBe(400);
    expect((await decide({ id: 999999999, status: 'approved' })).status).toBe(404);
  });

  it('approves with an adminNote; the decision is visible to the parent', async () => {
    asAdmin(true);
    const pending = await prisma.makeupRequest.findUniqueOrThrow({
      where: { studentId_sessionId: { studentId: childA.id, sessionId: sessionMissed.id } },
    });

    const res = await decide({
      id: pending.id,
      status: 'approved',
      adminNote: `موعد التعويض الأحد ${RUN}`,
    });
    expect(res.status).toBe(200);
    const { request } = await res.json();
    expect(request.status).toBe('approved');
    expect(request.adminNote).toBe(`موعد التعويض الأحد ${RUN}`);
    expect(request.decidedAt).toBeTruthy();

    asFamily(familyA.id);
    const mine = await (await accountGET()).json();
    const seen = mine.requests.find((r: { id: number }) => r.id === pending.id);
    expect(seen.status).toBe('approved');
    expect(seen.adminNote).toBe(`موعد التعويض الأحد ${RUN}`);
  });

  it('rejects without a note, preserving the existing adminNote', async () => {
    asAdmin(true);
    const pending = await prisma.makeupRequest.findUniqueOrThrow({
      where: { studentId_sessionId: { studentId: childA.id, sessionId: sessionExcused.id } },
    });
    // Seed an existing note, then decide WITHOUT adminNote — it must be kept.
    await prisma.makeupRequest.update({
      where: { id: pending.id },
      data: { adminNote: `ملاحظة سابقة ${RUN}` },
    });

    const res = await decide({ id: pending.id, status: 'rejected' });
    expect(res.status).toBe(200);
    const { request } = await res.json();
    expect(request.status).toBe('rejected');
    expect(request.adminNote).toBe(`ملاحظة سابقة ${RUN}`);
    expect(request.decidedAt).toBeTruthy();
  });

  it('GET lists all requests with pending ones first', async () => {
    asAdmin(true);
    // Create a fresh pending request (family B's absent child).
    asFamily(familyB.id);
    const created = await requestMakeup({ studentId: childB.id, sessionId: sessionMissed.id });
    expect(created.status).toBe(201);

    const res = await adminGET();
    expect(res.status).toBe(200);
    const { requests } = await res.json();
    const ids = [childA.id, childA2.id, childB.id];
    const ours = requests.filter((r: { student: { id: number } }) => ids.includes(r.student.id));
    expect(ours.length).toBe(3);
    // pending first
    const firstNonPending = ours.findIndex((r: { status: string }) => r.status !== 'pending');
    const lastPending = ours.map((r: { status: string }) => r.status).lastIndexOf('pending');
    if (firstNonPending !== -1) expect(lastPending).toBeLessThan(firstNonPending);
    // family details included for the admin
    expect(ours[0].student.family.parentName).toBeTruthy();
  });
});
