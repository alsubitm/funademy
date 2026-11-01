import { describe, it, expect, vi } from 'vitest';

const proxy = vi.hoisted(() => vi.fn());
vi.mock('@replit/connectors-sdk', () => ({
  ReplitConnectors: class { proxy = proxy; },
}));
import { createMeetEvent } from '@/lib/google-calendar';

describe('in-person calendar invitations', () => {
  it('keeps the invitation and venue but never requests or returns a video link', async () => {
    proxy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'event', hangoutLink: 'https://meet.google.com/legacy' }),
    });
    const result = await createMeetEvent({
      summary: 'In-person STEM trial', startsAt: new Date('2027-01-01T12:00:00Z'),
      durationMin: 45, attendeeEmail: 'parent@example.com',
      inPerson: true, location: 'Confirmed classroom',
    });
    const request = JSON.parse(proxy.mock.calls[0][2].body);
    expect(request.conferenceData).toBeUndefined();
    expect(request.location).toBe('Confirmed classroom');
    expect(request.attendees).toEqual([{ email: 'parent@example.com' }]);
    expect(result.meetUrl).toBeNull();
    expect(result.eventId).toBe('event');
  });
});
