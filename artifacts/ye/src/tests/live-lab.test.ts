import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const jar = new Map<string, string>();
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (name: string) => jar.has(name) ? { value: jar.get(name) } : undefined }) }));
vi.mock('@/lib/live-lab-calendar', () => ({ syncLiveCalendar: vi.fn(async () => ({ meetUrl: 'https://meet.google.com/test-room' })) }));
vi.mock('@/lib/google-calendar', () => ({ cancelCalendarEvent: vi.fn(async () => {}) }));
import { prisma } from '@/lib/db';
import { adminToken, ADMIN_COOKIE } from '@/lib/auth';
import { instructorToken, INSTRUCTOR_COOKIE } from '@/lib/instructor-auth';
import { GET, POST, PATCH } from '@/app/(ar)/svc/live-lab/route';
import { POST as invite, PATCH as revoke } from '@/app/(ar)/svc/live-lab/invitations/route';
import { POST as calendar } from '@/app/(ar)/svc/live-lab/calendar/route';
import { GET as student, POST as submit } from '@/app/(ar)/svc/live-lab/student/route';
import { syncLiveCalendar } from '@/lib/live-lab-calendar';
const prefix = `live-test-${Date.now()}`;
let teacher: number, other: number;
const req = (body: unknown, method = 'POST') => new Request('http://localhost/svc/live-lab', {
  method, headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(body),
});
const inviteRequest = (roomId: string, name: string, email: string) =>
  req({ roomId, name, email, idempotencyKey: randomUUID() });
const login = (id = teacher) => { jar.clear(); jar.set(INSTRUCTOR_COOKIE, instructorToken(id, 1)); };
const create = async () => {
  const r = await POST(req({ title: 'Windmill test', instructorId: teacher, startsAt: new Date(Date.now() + 3600000).toISOString(), durationMin: 60 }));
  expect(r.status).toBe(200);
  return (await r.json()).id as string;
};
const getStudent = (token: string) => student(new Request(`http://localhost/svc/live-lab/student?token=${token}`));
beforeAll(async () => {
  vi.stubEnv('SESSION_SECRET', 'isolated-live-lab-test-secret');
  teacher = (await prisma.instructor.create({ data: { name: 'Test teacher', email: `${prefix}@example.invalid`, passwordHash: 'unused' } })).id;
  other = (await prisma.instructor.create({ data: { name: 'Other teacher', email: `${prefix}-other@example.invalid`, passwordHash: 'unused' } })).id;
});
beforeEach(() => { login(); vi.mocked(syncLiveCalendar).mockResolvedValue({ meetUrl: 'https://meet.google.com/test-room' }); });
afterAll(async () => {
  await prisma.instructor.deleteMany({ where: { id: { in: [teacher, other] } } });
  await prisma.rateLimitHit.deleteMany({ where: { key: { in: [`live-create:${teacher}`, `live-create:${other}`, `live-calendar:${teacher}`] } } });
  vi.unstubAllEnvs();
});

describe('live Windmill classroom', () => {
  it('requires staff authority and isolates another instructor; admin sees all', async () => {
    const id = await create();
    jar.clear();
    expect((await GET()).status).toBe(401);
    login(other);
    expect((await (await GET()).json()).rooms).toEqual([]);
    expect((await PATCH(req({ id, version: 1, phase: 'teaching' }, 'PATCH'))).status).toBe(403);
    expect((await POST(req({ title: 'Not mine', instructorId: teacher, startsAt: new Date(Date.now() + 3600000).toISOString(), durationMin: 60 }))).status).toBe(403);
    jar.clear(); jar.set(ADMIN_COOKIE, adminToken());
    expect((await (await GET()).json()).rooms.some((r: { id: string }) => r.id === id)).toBe(true);
  });
  it('guards phase transitions, stale writes, motor and quiz until the build completes', async () => {
    const id = await create();
    expect((await PATCH(req({ id, version: 1, phase: 'quiz' }, 'PATCH'))).status).toBe(409);
    expect((await PATCH(req({ id, version: 1, phase: 'teaching' }, 'PATCH'))).status).toBe(200);
    expect((await PATCH(req({ id, version: 1, step: 1 }, 'PATCH'))).status).toBe(409);
    expect((await PATCH(req({ id, version: 2, motor: true }, 'PATCH'))).status).toBe(409);
    expect((await PATCH(req({ id, version: 2, step: 14 }, 'PATCH'))).status).toBe(200);
    expect((await PATCH(req({ id, version: 3, motor: true, speed: 2, reverse: true }, 'PATCH'))).status).toBe(200);
    expect((await PATCH(req({ id, version: 4, phase: 'quiz' }, 'PATCH'))).status).toBe(200);
    const room = await prisma.liveLabRoom.findUniqueOrThrow({ where: { id } });
    expect(room.motor).toBe(false);
    expect((await PATCH(req({ id, version: 5, phase: 'teaching' }, 'PATCH'))).status).toBe(409);
  });
  it('issues private invitations, grades once on the server, and revokes access', async () => {
    const id = await create();
    expect((await invite(inviteRequest(id, 'Student', 'guardian@example.invalid'))).status).toBe(200);
    expect((await invite(inviteRequest(id, 'Sibling', 'GUARDIAN@example.invalid'))).status).toBe(200);
    const guest = await prisma.liveLabGuest.findFirstOrThrow({ where: { roomId: id } });
    const waiting = await (await getStudent(guest.token)).json();
    expect(waiting.questions).toEqual([]);
    expect(JSON.stringify(waiting)).not.toContain(guest.email);
    expect(JSON.stringify(waiting)).not.toContain(guest.token);
    expect((await submit(req({ token: guest.token, answers: [0, 1, 2, 0, 1] }))).status).toBe(409);
    await PATCH(req({ id, version: 1, phase: 'teaching', step: 14 }, 'PATCH'));
    await PATCH(req({ id, version: 2, phase: 'quiz' }, 'PATCH'));
    const quiz = await (await getStudent(guest.token)).json();
    expect(quiz.questions).toHaveLength(5);
    expect(quiz.questions[0]).not.toHaveProperty('answer');
    expect((await submit(req({ token: guest.token, answers: [0] }))).status).toBe(400);
    const results = await Promise.all([
      submit(req({ token: guest.token, answers: [0, 1, 2, 0, 1] })),
      submit(req({ token: guest.token, answers: [0, 1, 2, 0, 1] })),
    ]);
    for (const r of results) expect(await r.json()).toEqual({ score: 5, total: 5 });
    expect(await (await submit(req({ token: guest.token, answers: [2, 2, 2, 2, 2] }))).json()).toEqual({ score: 5, total: 5 });
    expect((await revoke(req({ roomId: id, guestId: guest.id, revoked: true }, 'PATCH'))).status).toBe(200);
    expect((await getStudent(guest.token)).status).toBe(404);
    expect((await submit(req({ token: guest.token, answers: [0, 1, 2, 0, 1] }))).status).toBe(404);
  });
  it('keeps siblings private with independent results, revocation and restoration', async () => {
    const id = await create();
    for (const [name, email] of [['Sibling A', 'Guardian@example.invalid'], ['Sibling B', 'guardian@example.invalid']]) {
      expect((await invite(inviteRequest(id, name, email))).status).toBe(200);
    }
    const [a, b] = await prisma.liveLabGuest.findMany({ where: { roomId: id }, orderBy: { name: 'asc' } });
    expect(a.email).toBe(b.email);
    expect(a.token).not.toBe(b.token);
    const viewA = await (await getStudent(a.token)).json();
    expect(viewA.name).toBe('Sibling A');
    expect(JSON.stringify(viewA)).not.toContain(b.name);
    expect(JSON.stringify(viewA)).not.toContain(b.token);
    expect(JSON.stringify(viewA)).not.toContain(a.email);
    expect((await prisma.liveLabGuest.findUniqueOrThrow({ where: { id: b.id } })).joinedAt).toBeNull();
    expect((await calendar(req({ roomId: id }))).status).toBe(200);
    expect(await prisma.liveLabGuest.count({ where: { roomId: id, invitedAt: { not: null } } })).toBe(2);
    await PATCH(req({ id, version: 1, phase: 'teaching', step: 14 }, 'PATCH'));
    await PATCH(req({ id, version: 2, phase: 'quiz' }, 'PATCH'));
    expect(await (await submit(req({ token: a.token, answers: [0, 1, 2, 0, 1] }))).json()).toEqual({ score: 5, total: 5 });
    expect((await (await getStudent(b.token)).json()).submission).toBeNull();
    expect((await revoke(req({ roomId: id, guestId: a.id, revoked: true }, 'PATCH'))).status).toBe(200);
    expect((await getStudent(a.token)).status).toBe(404);
    expect((await submit(req({ token: a.token, answers: [0, 1, 2, 0, 1] }))).status).toBe(404);
    expect(await (await submit(req({ token: b.token, answers: [2, 2, 2, 2, 2] }))).json()).toEqual({ score: 1, total: 5 });
    expect((await calendar(req({ roomId: id }))).status).toBe(200);
    expect(vi.mocked(syncLiveCalendar).mock.calls.at(-1)?.[1]).toEqual([b.email]);
    expect((await revoke(req({ roomId: id, guestId: a.id, revoked: false }, 'PATCH'))).status).toBe(200);
    expect((await (await getStudent(a.token)).json()).submission).toEqual({ score: 5, total: 5 });
    expect(await (await submit(req({ token: b.token, answers: [0, 1, 2, 0, 1] }))).json()).toEqual({ score: 1, total: 5 });
  });
  it('reuses one guest and private token for concurrent invitation retries', async () => {
    const id = await create();
    const body = { roomId: id, name: 'Same Name', email: 'guardian@example.invalid', idempotencyKey: `retry-${prefix}-${id}` };
    const responses = await Promise.all([invite(req(body)), invite(req(body))]);
    expect(responses.map(r => r.status)).toEqual([200, 200]);

    const guests = await prisma.liveLabGuest.findMany({ where: { roomId: id } });
    expect(guests).toHaveLength(1);
    expect(guests[0].idempotencyKey).toBe(body.idempotencyKey);
    expect(guests[0].token).toMatch(/^[0-9a-f]{64}$/);
  });
  it('keeps a revoked guest disabled when the original invitation is replayed', async () => {
    const id = await create();
    const body = { roomId: id, name: 'Revoked Student', email: 'guardian@example.invalid', idempotencyKey: `revoked-retry-${prefix}-${id}` };
    expect((await invite(req(body))).status).toBe(200);
    const guest = await prisma.liveLabGuest.findFirstOrThrow({ where: { roomId: id } });

    expect((await revoke(req({ roomId: id, guestId: guest.id, revoked: true }, 'PATCH'))).status).toBe(200);
    expect((await getStudent(guest.token)).status).toBe(404);
    expect((await invite(req(body))).status).toBe(200);

    const replayed = await prisma.liveLabGuest.findUniqueOrThrow({ where: { id: guest.id } });
    expect(replayed.revoked).toBe(true);
    expect(replayed.token).toBe(guest.token);
    expect((await getStudent(replayed.token)).status).toBe(404);
  });
  it('allows a distinct same-name student and replays a committed invitation when full', async () => {
    const id = await create();
    const body = { roomId: id, name: 'Same Name', email: 'guardian@example.invalid', idempotencyKey: `same-${prefix}-${id}` };
    expect((await invite(req(body))).status).toBe(200);
    const original = await prisma.liveLabGuest.findFirstOrThrow({ where: { roomId: id } });
    expect((await invite(req({ ...body, idempotencyKey: `distinct-${prefix}-${id}` }))).status).toBe(200);
    await prisma.liveLabGuest.createMany({ data: Array.from({ length: 14 }, (_, i) => ({
      roomId: id, name: `Other ${i}`, email: 'other@example.invalid', token: `${id}-${i}`,
    })) });

    expect((await invite(req(body))).status).toBe(200);
    expect((await PATCH(req({ id, version: 1, phase: 'teaching' }, 'PATCH'))).status).toBe(200);
    expect((await invite(req(body))).status).toBe(200);
    const guests = await prisma.liveLabGuest.findMany({ where: { roomId: id, name: 'Same Name' } });
    expect(guests).toHaveLength(2);
    expect(guests.find(g => g.id === original.id)?.token).toBe(original.token);
    expect(new Set(guests.map(g => g.token)).size).toBe(2);
  });
  it('corrects only the selected guest name without changing access, seat, contact, or quiz result', async () => {
    const id = await create();
    await invite(inviteRequest(id, 'Wrong sibling', 'guardian@example.invalid'));
    await invite(inviteRequest(id, 'Correct sibling', 'guardian@example.invalid'));
    const [guest, sibling] = await prisma.liveLabGuest.findMany({ where: { roomId: id }, orderBy: { name: 'asc' } });
    await PATCH(req({ id, version: 1, phase: 'teaching', step: 14 }, 'PATCH'));
    await PATCH(req({ id, version: 2, phase: 'quiz' }, 'PATCH'));
    expect(await (await submit(req({ token: guest.token, answers: [0, 1, 2, 0, 1] }))).json()).toEqual({ score: 5, total: 5 });
    const before = await prisma.liveLabGuest.findUniqueOrThrow({ where: { id: guest.id } });

    expect((await revoke(req({ roomId: id, guestId: guest.id, name: 'Fixed sibling' }, 'PATCH'))).status).toBe(200);

    const after = await prisma.liveLabGuest.findUniqueOrThrow({ where: { id: guest.id } });
    expect(after.name).toBe('Fixed sibling');
    expect(after.token).toBe(before.token);
    expect(after.email).toBe(before.email);
    expect(after.revoked).toBe(before.revoked);
    expect(after.invitedAt).toEqual(before.invitedAt);
    expect(after.joinedAt).toEqual(before.joinedAt);
    expect(after.submittedAt).toEqual(before.submittedAt);
    expect(after.answers).toEqual(before.answers);
    expect(after.score).toBe(before.score);
    expect((await (await getStudent(after.token)).json()).name).toBe('Fixed sibling');
    expect((await prisma.liveLabGuest.findUniqueOrThrow({ where: { id: sibling.id } })).name).toBe('Wrong sibling');

    expect((await revoke(req({ roomId: id, guestId: sibling.id, name: '   ' }, 'PATCH'))).status).toBe(400);
    expect((await revoke(req({ roomId: id, guestId: sibling.id, name: 'Another', revoked: true }, 'PATCH'))).status).toBe(400);
  });
  it('enforces room ownership and guest scoping for name corrections', async () => {
    const id = await create();
    await invite(inviteRequest(id, 'Student', 'guardian@example.invalid'));
    const guest = await prisma.liveLabGuest.findFirstOrThrow({ where: { roomId: id } });
    const otherRoom = await create();

    expect((await revoke(req({ roomId: otherRoom, guestId: guest.id, name: 'Wrong room' }, 'PATCH'))).status).toBe(404);
    login(other);
    expect((await revoke(req({ roomId: id, guestId: guest.id, name: 'Not authorized' }, 'PATCH'))).status).toBe(403);
    login();
    await PATCH(req({ id, version: 1, phase: 'ended' }, 'PATCH'));
    expect((await revoke(req({ roomId: id, guestId: guest.id, name: 'Too late' }, 'PATCH'))).status).toBe(409);
    expect((await prisma.liveLabGuest.findUniqueOrThrow({ where: { id: guest.id } })).name).toBe('Student');
  });
  it('serializes sibling invitations and restoration at the sixteen-seat limit', async () => {
    const id = await create();
    await prisma.liveLabGuest.createMany({ data: Array.from({ length: 15 }, (_, i) => ({
      roomId: id, name: `Sibling ${i}`, email: 'family@example.invalid', token: `${id}-${i}`,
    })) });
    const r = await Promise.all(['a', 'b'].map(n => invite(inviteRequest(id, n, 'family@example.invalid'))));
    expect(r.map(x => x.status).sort()).toEqual([200, 409]);
    expect(await prisma.liveLabGuest.count({ where: { roomId: id, revoked: false } })).toBe(16);
    const guest = await prisma.liveLabGuest.findFirstOrThrow({ where: { roomId: id } });
    expect((await revoke(req({ roomId: id, guestId: guest.id, revoked: true }, 'PATCH'))).status).toBe(200);
    const competing = await Promise.all([
      revoke(req({ roomId: id, guestId: guest.id, revoked: false }, 'PATCH')),
      invite(inviteRequest(id, 'Another sibling', 'family@example.invalid')),
    ]);
    expect(competing.map(x => x.status).sort()).toEqual([200, 409]);
    expect(await prisma.liveLabGuest.count({ where: { roomId: id, revoked: false } })).toBe(16);
  });
  it('keeps a failed calendar send unsent and supports a pending Meet response', async () => {
    const id = await create();
    await invite(inviteRequest(id, 'Student', 'guardian@example.invalid'));
    vi.mocked(syncLiveCalendar).mockRejectedValueOnce(new Error('provider failed'));
    expect((await calendar(req({ roomId: id }))).status).toBe(503);
    expect((await prisma.liveLabGuest.findFirstOrThrow({ where: { roomId: id } })).invitedAt).toBeNull();
    vi.mocked(syncLiveCalendar).mockResolvedValueOnce({ meetUrl: null });
    expect(await (await calendar(req({ roomId: id }))).json()).toEqual({ ok: true, meetUrl: null });
    expect((await prisma.liveLabRoom.findUniqueOrThrow({ where: { id } })).calendarStatus).toBe('pending');
    expect((await calendar(req({ roomId: id }))).status).toBe(200);
    expect((await prisma.liveLabRoom.findUniqueOrThrow({ where: { id } })).calendarStatus).toBe('ready');
  });
  it('rejects cross-site mutations and expired links', async () => {
    const id = await create();
    expect((await PATCH(new Request('http://localhost/svc/live-lab', {
      method: 'PATCH', headers: { 'content-type': 'application/json', origin: 'https://attacker.invalid' },
      body: JSON.stringify({ id, version: 1, phase: 'teaching' }),
    }))).status).toBe(403);
    await invite(inviteRequest(id, 'Student', 'guardian@example.invalid'));
    const guest = await prisma.liveLabGuest.findFirstOrThrow({ where: { roomId: id } });
    await prisma.liveLabRoom.update({ where: { id }, data: { startsAt: new Date(Date.now() - 3 * 86400000) } });
    expect((await getStudent(guest.token)).status).toBe(410);
  });
});
