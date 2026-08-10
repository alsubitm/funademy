/**
 * Live-class & recording links:
 * admin sets a run-level meeting link (online runs) and per-session
 * override/recording links → the portal query returns those links only
 * for children enrolled (active/pending) in the run — independent of
 * attendance rows — and never for other families' children.
 *
 * Runs against the isolated ye_test database, calling the Next.js route
 * handlers directly with a mocked cookie store (same pattern as
 * payments.test.ts).
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
import { ADMIN_COOKIE, adminToken } from '@/lib/auth';
import { PATCH as runsPATCH } from '@/app/(ar)/svc/admin/runs/route';
import { PATCH as sessionsPATCH } from '@/app/(ar)/svc/admin/sessions/route';
import { portalSessions, joinUrlFor } from '@/lib/portal-sessions';

const RUN = `links-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const NOW = new Date('2026-08-08T12:00:00Z');

function jsonReq(url: string, method: string, body: unknown) {
  return new NextRequest(`http://test.local${url}`, {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}
const asAdmin = () => cookieJar.set(ADMIN_COOKIE, adminToken());
const asNobody = () => cookieJar.delete(ADMIN_COOKIE);

let onlineRunId: number;
let inPersonRunId: number;
let pastSessionId: number;
let futureSessionId: number;
let enrolledChildId: number; // enrolled in the online run
let otherChildId: number; // other family, not enrolled

beforeAll(async () => {
  const program = await prisma.program.create({
    data: {
      slug: `prog-${RUN}`,
      kitCode: 'KIT-01',
      nameEn: `Links Program ${RUN}`,
      nameAr: `برنامج روابط ${RUN}`,
      ageMin: 4,
      ageMax: 6,
      format: 'online',
      color: '#1C54CB',
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

  const onlineRun = await prisma.courseRun.create({
    data: {
      programId: program.id,
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-09-30'),
      weekday: 0,
      time: '17:00',
      format: 'online',
      sessions: {
        createMany: {
          data: [
            { date: new Date('2026-08-02T14:00:00Z') }, // past
            { date: new Date('2026-08-16T14:00:00Z') }, // future
          ],
        },
      },
    },
    include: { sessions: { orderBy: { date: 'asc' } } },
  });
  onlineRunId = onlineRun.id;
  pastSessionId = onlineRun.sessions[0].id;
  futureSessionId = onlineRun.sessions[1].id;

  const inPersonRun = await prisma.courseRun.create({
    data: {
      programId: program.id,
      startDate: new Date('2026-08-01'),
      endDate: new Date('2026-09-30'),
      weekday: 1,
      time: '17:00',
      format: 'in_person',
      sessions: { createMany: { data: [{ date: new Date('2026-08-17T14:00:00Z') }] } },
    },
  });
  inPersonRunId = inPersonRun.id;

  const famA = await prisma.family.create({
    data: {
      phone: `+9665${Math.floor(10000000 + Math.random() * 89999999)}`,
      parentName: 'A',
      students: { create: { firstName: 'طفل أ', birthYear: 2019 } },
    },
    include: { students: true },
  });
  enrolledChildId = famA.students[0].id;
  await prisma.enrollment.create({
    data: { studentId: enrolledChildId, courseRunId: onlineRunId, status: 'active' },
  });
  await prisma.enrollment.create({
    data: { studentId: enrolledChildId, courseRunId: inPersonRunId, status: 'active' },
  });

  const famB = await prisma.family.create({
    data: {
      phone: `+9665${Math.floor(10000000 + Math.random() * 89999999)}`,
      parentName: 'B',
      students: { create: { firstName: 'طفل ب', birthYear: 2019 } },
    },
    include: { students: true },
  });
  otherChildId = famB.students[0].id;
});

afterAll(async () => {
  await prisma.program.deleteMany({ where: { slug: `prog-${RUN}` } });
});

describe('admin link management', () => {
  it('rejects link edits without an admin session', async () => {
    asNobody();
    const res = await runsPATCH(jsonReq('/svc/admin/runs', 'PATCH', { id: onlineRunId, meetingUrl: 'https://zoom.us/j/x' }));
    expect(res.status).toBe(401);
    const res2 = await sessionsPATCH(jsonReq('/svc/admin/sessions', 'PATCH', { id: pastSessionId, recordingUrl: 'https://x.test/r' }));
    expect(res2.status).toBe(401);
  });

  it('rejects non-http(s) URLs', async () => {
    asAdmin();
    const res = await runsPATCH(jsonReq('/svc/admin/runs', 'PATCH', { id: onlineRunId, meetingUrl: 'javascript:alert(1)' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('bad_url');
    const res2 = await sessionsPATCH(jsonReq('/svc/admin/sessions', 'PATCH', { id: pastSessionId, recordingUrl: 'ftp://x' }));
    expect(res2.status).toBe(400);
    expect((await res2.json()).error).toBe('bad_url');
  });

  it('saves run meeting link, session override and recording link', async () => {
    asAdmin();
    const r1 = await runsPATCH(jsonReq('/svc/admin/runs', 'PATCH', { id: onlineRunId, meetingUrl: 'https://zoom.us/j/run-level' }));
    expect(r1.status).toBe(200);
    expect((await r1.json()).run.meetingUrl).toBe('https://zoom.us/j/run-level');

    const r2 = await sessionsPATCH(jsonReq('/svc/admin/sessions', 'PATCH', { id: pastSessionId, recordingUrl: 'https://videos.test/rec-1' }));
    expect(r2.status).toBe(200);
    expect((await r2.json()).session.recordingUrl).toBe('https://videos.test/rec-1');
  });
});

describe('portal link visibility', () => {
  it('enrolled child sees the run-level live link on upcoming online sessions', async () => {
    const { upcoming } = await portalSessions(enrolledChildId, NOW);
    const online = upcoming.find((s) => s.id === futureSessionId);
    expect(online).toBeTruthy();
    expect(joinUrlFor(online!)).toBe('https://zoom.us/j/run-level');
  });

  it('a per-session override wins over the run-level link', async () => {
    asAdmin();
    const res = await sessionsPATCH(jsonReq('/svc/admin/sessions', 'PATCH', { id: futureSessionId, meetingUrl: 'https://meet.google.com/override' }));
    expect(res.status).toBe(200);
    const { upcoming } = await portalSessions(enrolledChildId, NOW);
    expect(joinUrlFor(upcoming.find((s) => s.id === futureSessionId)!)).toBe('https://meet.google.com/override');
  });

  it('in-person sessions never get a live link', async () => {
    const { upcoming } = await portalSessions(enrolledChildId, NOW);
    const inPerson = upcoming.find((s) => s.courseRunId === inPersonRunId);
    expect(inPerson).toBeTruthy();
    expect(joinUrlFor(inPerson!)).toBeNull();
  });

  it('recording is visible to the enrolled child even without any attendance rows', async () => {
    const rows = await prisma.attendance.count({ where: { studentId: enrolledChildId } });
    expect(rows).toBe(0);
    const { recorded } = await portalSessions(enrolledChildId, NOW);
    expect(recorded.map((s) => s.id)).toContain(pastSessionId);
    expect(recorded.find((s) => s.id === pastSessionId)!.recordingUrl).toBe('https://videos.test/rec-1');
  });

  it('a cancelled session recording is hidden', async () => {
    await prisma.classSession.update({ where: { id: pastSessionId }, data: { status: 'cancelled' } });
    const { recorded } = await portalSessions(enrolledChildId, NOW);
    expect(recorded.map((s) => s.id)).not.toContain(pastSessionId);
    await prisma.classSession.update({ where: { id: pastSessionId }, data: { status: 'completed' } });
    const again = await portalSessions(enrolledChildId, NOW);
    expect(again.recorded.map((s) => s.id)).toContain(pastSessionId);
  });

  it('a non-enrolled family receives no sessions or links at all', async () => {
    const { upcoming, recorded } = await portalSessions(otherChildId, NOW);
    expect(upcoming).toHaveLength(0);
    expect(recorded).toHaveLength(0);
  });
});
