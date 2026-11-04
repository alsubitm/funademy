import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { LiveLabRoom } from '@prisma/client';
const { proxy } = vi.hoisted(() => ({ proxy: vi.fn() }));
vi.mock('@replit/connectors-sdk', () => ({ ReplitConnectors: class { proxy = proxy; } }));
import { syncLiveCalendar } from '@/lib/live-lab-calendar';
const room = {
  id: '12345678-1234-1234-1234-123456789abc', title: 'Windmill', startsAt: new Date('2027-01-01T12:00:00Z'), durationMin: 60,
} as LiveLabRoom;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
beforeEach(() => proxy.mockReset());
describe('one Google Meet per live Windmill session', () => {
  it('uses a deterministic event and conference id, private guest list and no student tokens', async () => {
    proxy.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({
      id: 'event', hangoutLink: 'https://meet.google.com/abc-defg-hij',
      attendees: [{ email: 'family@example.invalid' }, { email: 'teacher@example.invalid' }],
    }));
    expect(await syncLiveCalendar(room, ['family@example.invalid'], 'teacher@example.invalid')).toEqual({ meetUrl: 'https://meet.google.com/abc-defg-hij' });
    const call = proxy.mock.calls[1];
    const payload = JSON.parse(call[2].body);
    expect(payload.id).toBe('lab12345678123412341234123456789abc');
    expect(payload.conferenceData.createRequest.requestId).toBe(payload.id);
    expect(payload.guestsCanSeeOtherGuests).toBe(false);
    expect(payload.guestsCanInviteOthers).toBe(false);
    expect(payload.description).not.toContain('/live/');
    expect(call[1]).toContain('sendUpdates=all');
    expect(proxy).toHaveBeenCalledTimes(2);
  });
  it('recovers an existing event without sending duplicate emails', async () => {
    proxy.mockResolvedValueOnce(json({
      id: 'event', hangoutLink: 'https://meet.google.com/abc-defg-hij',
      attendees: [{ email: 'family@example.invalid' }, { email: 'teacher@example.invalid' }],
    }));
    await syncLiveCalendar(room, ['family@example.invalid'], 'teacher@example.invalid');
    expect(proxy).toHaveBeenCalledTimes(1);
  });
  it('repairs a changed guest list on a recovered create conflict', async () => {
    proxy.mockResolvedValueOnce(json({}, 404)).mockResolvedValueOnce(json({}, 409))
      .mockResolvedValueOnce(json({ id: 'event', attendees: [{ email: 'old@example.invalid' }] }))
      .mockResolvedValueOnce(json({
        id: 'event', hangoutLink: 'https://meet.google.com/abc-defg-hij',
        attendees: [{ email: 'new@example.invalid' }, { email: 'teacher@example.invalid' }],
      }));
    await syncLiveCalendar(room, ['new@example.invalid'], 'teacher@example.invalid');
    expect(proxy.mock.calls[3][2].method).toBe('PATCH');
    expect(JSON.parse(proxy.mock.calls[3][2].body).attendees).toEqual([{ email: 'new@example.invalid' }, { email: 'teacher@example.invalid' }]);
  });
  it('does not fabricate a meeting when conference creation is pending', async () => {
    proxy.mockResolvedValueOnce(json({
      id: 'event', attendees: [{ email: 'teacher@example.invalid' }],
      conferenceData: { createRequest: { status: { statusCode: 'pending' } } },
    }));
    expect(await syncLiveCalendar(room, [], 'teacher@example.invalid')).toEqual({ meetUrl: null });
  });
  it('fails explicitly when Google rejects access', async () => {
    proxy.mockResolvedValueOnce(json({}, 403));
    await expect(syncLiveCalendar(room, [], 'teacher@example.invalid')).rejects.toThrow();
    expect(proxy).toHaveBeenCalledTimes(1);
  });
});
