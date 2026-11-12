import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
const { proxy, jar } = vi.hoisted(() => ({ proxy: vi.fn(), jar: new Map<string, string>() }));
vi.mock('@replit/connectors-sdk', () => ({ ReplitConnectors: class { proxy = proxy; } }));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: (n: string) => jar.has(n) ? { value: jar.get(n) } : undefined }) }));
vi.mock('@/lib/live-lab-calendar', () => ({ syncLiveCalendar: vi.fn(async () => ({ meetUrl: null })) }));
import { prisma } from '@/lib/db';
import { instructorToken, INSTRUCTOR_COOKIE } from '@/lib/instructor-auth';
import { POST as invite, PATCH as change } from '@/app/(ar)/svc/live-lab/invitations/route';
import { POST as email } from '@/app/(ar)/svc/live-lab/invitations/email/route';
import { POST as calendar } from '@/app/(ar)/svc/live-lab/calendar/route';
import { GET as rooms } from '@/app/(ar)/svc/live-lab/route';
import { GET as student } from '@/app/(ar)/svc/live-lab/student/route';
import { sendPrivateLabEmail } from '@/lib/live-lab-email';
const req = (body: unknown) => new Request('http://localhost/svc/live-lab/invitations/email', {
  method: 'POST', headers: { origin: 'http://localhost', 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
let teacher: number, other: number, roomId: string;
const actor = () => ({ role: 'instructor' as const, id: teacher, version: 1 });
const guest = () => prisma.liveLabGuest.findFirstOrThrow({ where: { roomId } });
const add = (extra: object = {}) => invite(req({
  roomId, name: 'Student', email: 'guardian@example.invalid', idempotencyKey: randomUUID(), ...extra,
}));
beforeAll(async () => {
  vi.stubEnv('SESSION_SECRET', 'email-isolated-test-secret');
  vi.stubEnv('SITE_URL', 'https://funademy.io');
  teacher = (await prisma.instructor.create({ data: { name: 'Email test', email: `${randomUUID()}@example.invalid`, passwordHash: 'unused' } })).id;
  other = (await prisma.instructor.create({ data: { name: 'Other', email: `${randomUUID()}@example.invalid`, passwordHash: 'unused' } })).id;
});
beforeEach(async () => {
  proxy.mockReset().mockImplementation(async () => json({ id: 'provider-test-id' }));
  jar.clear(); jar.set(INSTRUCTOR_COOKIE, instructorToken(teacher, 1));
  roomId = (await prisma.liveLabRoom.create({ data: {
    title: 'Windmill test', instructorId: teacher, startsAt: new Date(Date.now() + 3600000),
  } })).id;
});
afterAll(async () => {
  await prisma.instructor.deleteMany({ where: { id: { in: [teacher, other] } } });
  await prisma.rateLimitHit.deleteMany({ where: { key: { in: [`live-email:${teacher}`, `live-email:${other}`, `live-calendar:${teacher}`] } } });
  vi.unstubAllEnvs();
});
describe('private lab email delivery', () => {
  it('sends automatically only with explicit consent, one guardian and one private token per message', async () => {
    expect((await add()).status).toBe(200);
    expect(proxy).not.toHaveBeenCalled();
    const first = await guest();
    await add({ name: 'Sibling', emailConsent: true });
    await add({ name: 'Other child', email: 'other@example.invalid', emailConsent: true });
    expect(proxy).toHaveBeenCalledTimes(2);
    const all = await prisma.liveLabGuest.findMany({ where: { roomId }, orderBy: { name: 'asc' } });
    for (const call of proxy.mock.calls) {
      expect(call[0]).toBe('resend');
      expect(call[1]).toBe('/emails');
      const payload = JSON.parse(call[2].body);
      expect(payload.from).toBe('FunAdemy <info@funademy.io>');
      expect(payload.to).toHaveLength(1);
      expect(payload.cc).toBeUndefined();
      expect(payload.bcc).toBeUndefined();
      expect(payload.text).toContain('https://funademy.io/windmill/live/');
      expect(payload.text).toContain('Asia/Riyadh');
      const tokens = all.filter(g => payload.text.includes(g.token));
      expect(tokens).toHaveLength(1);
      expect(payload.to).toEqual([tokens[0].email]);
      expect(payload.text).not.toContain(first.token);
    }
  });
  it('records consent for existing guests and does not resend after response loss or concurrent retries', async () => {
    await add();
    const g = await guest();
    expect((await email(req({ roomId, guestId: g.id }))).status).toBe(200);
    expect(proxy).not.toHaveBeenCalled();
    await Promise.all([true, true].map(consent => email(req({ roomId, guestId: g.id, consent }))));
    expect(proxy).toHaveBeenCalledTimes(1);
    await email(req({ roomId, guestId: g.id }));
    expect(proxy).toHaveBeenCalledTimes(1);
    expect((await guest()).emailConsentAt).not.toBeNull();
    expect((await guest()).privateEmailSentAt).not.toBeNull();
  });
  it('replays identical persisted content and key after an ambiguous send and a name correction', async () => {
    proxy.mockRejectedValueOnce(new Error('network failure with private details'));
    const idempotencyKey = randomUUID();
    expect((await add({ emailConsent: true, idempotencyKey })).status).toBe(200);
    const g = await guest();
    expect(g.privateEmailStatus).toBe('failed');
    expect(g.privateEmailError).toBe('provider_unavailable');
    await change(req({ roomId, guestId: g.id, name: 'Corrected name' }));
    await email(req({ roomId, guestId: g.id }));
    expect(proxy.mock.calls[1][2].body).toBe(proxy.mock.calls[0][2].body);
    expect(proxy.mock.calls[1][2].headers['Idempotency-Key']).toBe(proxy.mock.calls[0][2].headers['Idempotency-Key']);
    expect((await guest()).name).toBe('Corrected name');
    expect((await guest()).privateEmailStatus).toBe('sent');
  });
  it('keeps successful invitation creation idempotent without another email', async () => {
    const body = { emailConsent: true, idempotencyKey: randomUUID() };
    await add(body); await add(body);
    expect(await prisma.liveLabGuest.count({ where: { roomId } })).toBe(1);
    expect(proxy).toHaveBeenCalledTimes(1);
  });
  it('recovers provider success when the local sent status was lost', async () => {
    await add({ emailConsent: true });
    const g = await guest();
    await prisma.liveLabGuest.update({ where: { id: g.id }, data: {
      privateEmailSentAt: null, privateEmailStatus: 'pending', privateEmailProviderId: null,
    } });
    await email(req({ roomId, guestId: g.id }));
    expect(proxy.mock.calls[1][2]).toEqual(proxy.mock.calls[0][2]);
    expect((await guest()).privateEmailProviderId).toBe('provider-test-id');
  });
  it('stops retries outside the provider deduplication window instead of risking duplicates', async () => {
    proxy.mockRejectedValueOnce(new Error('timeout'));
    await add({ emailConsent: true });
    const g = await guest();
    await prisma.liveLabGuest.update({ where: { id: g.id }, data: {
      privateEmailAttemptedAt: new Date(Date.now() - 24 * 3600000),
    } });
    expect(await sendPrivateLabEmail(actor(), roomId, g.id)).toBe('review_required');
    expect(proxy).toHaveBeenCalledTimes(1);
    expect((await guest()).privateEmailError).toBe('retry_window_expired');
  });
  it('never emails revoked guests, ended rooms or expired links', async () => {
    await add();
    const g = await guest();
    await change(req({ roomId, guestId: g.id, revoked: true }));
    await email(req({ roomId, guestId: g.id, consent: true }));
    await change(req({ roomId, guestId: g.id, revoked: false }));
    await prisma.liveLabRoom.update({ where: { id: roomId }, data: { phase: 'ended' } });
    await email(req({ roomId, guestId: g.id, consent: true }));
    await prisma.liveLabRoom.update({ where: { id: roomId }, data: { phase: 'waiting', startsAt: new Date(0) } });
    await email(req({ roomId, guestId: g.id, consent: true }));
    expect(proxy).not.toHaveBeenCalled();
  });
  it('blocks other instructors, unauthenticated callers and cross-site requests', async () => {
    await add();
    const g = await guest();
    jar.clear();
    expect((await email(req({ roomId, guestId: g.id, consent: true }))).status).toBe(401);
    jar.set(INSTRUCTOR_COOKIE, instructorToken(other, 1));
    expect((await email(req({ roomId, guestId: g.id, consent: true }))).status).toBe(403);
    const cross = new Request('http://localhost/svc/live-lab/invitations/email', {
      method: 'POST', headers: { origin: 'https://attacker.invalid' },
    });
    expect((await email(cross)).status).toBe(403);
    expect(proxy).not.toHaveBeenCalled();
  });
  it('shows private-email failures separately from successful Calendar sync and retries only unsent guests', async () => {
    proxy.mockResolvedValueOnce(json({ message: 'secret details' }, 403));
    await add({ emailConsent: true });
    const failed = await guest();
    expect(failed.privateEmailError).toBe('sender_not_authorized');
    expect(failed.invitedAt).toBeNull();
    await add({ name: 'Another', emailConsent: true });
    expect((await calendar(req({ roomId }))).status).toBe(200);
    expect(proxy).toHaveBeenCalledTimes(3);
    expect((await guest()).invitedAt).not.toBeNull();
    expect((await guest()).privateEmailStatus).toBe('sent');
  });
  it('does not expose saved email contents or provider metadata in staff or student responses', async () => {
    await add({ emailConsent: true });
    const g = await guest();
    const staffJson = JSON.stringify(await (await rooms()).json());
    expect(staffJson).not.toContain('privateEmailPayload');
    expect(staffJson).not.toContain('provider-test-id');
    const studentJson = JSON.stringify(await (await student(new Request(`http://localhost/svc/live-lab/student?token=${g.token}`))).json());
    expect(studentJson).not.toContain('privateEmail');
    expect(studentJson).not.toContain(g.email);
    expect(studentJson).not.toContain(g.token);
  });
});
