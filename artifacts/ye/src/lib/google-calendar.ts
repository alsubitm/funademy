/**
 * Google Calendar via the Replit connector — creates appointment events with
 * an auto-generated Google Meet link. Invitations are emailed by Google
 * itself (sendUpdates=all) when the guest provides an email address.
 */
import { ReplitConnectors } from '@replit/connectors-sdk';

export type MeetEvent = {
  eventId: string;
  meetUrl: string | null;
  htmlLink: string | null;
};

export async function createMeetEvent(opts: {
  summary: string;
  description?: string;
  startsAt: Date;
  durationMin: number;
  attendeeEmail?: string | null;
}): Promise<MeetEvent> {
  const connectors = new ReplitConnectors();
  const end = new Date(opts.startsAt.getTime() + opts.durationMin * 60_000);
  const body: Record<string, unknown> = {
    summary: opts.summary,
    description: opts.description ?? '',
    start: { dateTime: opts.startsAt.toISOString(), timeZone: 'Asia/Riyadh' },
    end: { dateTime: end.toISOString(), timeZone: 'Asia/Riyadh' },
    conferenceData: { createRequest: { requestId: `funademy-${Date.now()}-${Math.random().toString(36).slice(2, 10)}` } },
  };
  if (opts.attendeeEmail) body.attendees = [{ email: opts.attendeeEmail }];

  const res = await connectors.proxy(
    'google-calendar',
    '/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Google Calendar event creation failed (${res.status}): ${text.slice(0, 300)}`);
  }
  const event = (await res.json()) as {
    id: string;
    htmlLink?: string;
    hangoutLink?: string;
    conferenceData?: { entryPoints?: { entryPointType?: string; uri?: string }[] };
  };
  const meetUrl =
    event.hangoutLink ??
    event.conferenceData?.entryPoints?.find((e) => e.entryPointType === 'video')?.uri ??
    null;
  return { eventId: event.id, meetUrl, htmlLink: event.htmlLink ?? null };
}

/** Adds a guest to an existing event (Google re-emails the invitation). */
export async function addAttendeeToEvent(eventId: string, email: string): Promise<void> {
  const connectors = new ReplitConnectors();
  const path = `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`;
  const getRes = await connectors.proxy('google-calendar', path, { method: 'GET' });
  if (!getRes.ok) throw new Error(`Google Calendar event fetch failed (${getRes.status})`);
  const event = (await getRes.json()) as { attendees?: { email?: string }[] };
  const attendees = event.attendees ?? [];
  if (attendees.some((a) => a.email?.toLowerCase() === email.toLowerCase())) return;
  attendees.push({ email });
  const patchRes = await connectors.proxy('google-calendar', `${path}?sendUpdates=all`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ attendees }),
  });
  if (!patchRes.ok) throw new Error(`Google Calendar attendee update failed (${patchRes.status})`);
}

export async function cancelCalendarEvent(eventId: string): Promise<void> {
  const connectors = new ReplitConnectors();
  const res = await connectors.proxy(
    'google-calendar',
    `/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}?sendUpdates=all`,
    { method: 'DELETE' },
  );
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error(`Google Calendar event cancellation failed (${res.status})`);
  }
}
