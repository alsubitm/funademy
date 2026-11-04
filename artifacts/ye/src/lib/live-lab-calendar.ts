import { ReplitConnectors } from '@replit/connectors-sdk';
import type { LiveLabRoom } from '@prisma/client';

type Event = {
  id: string; status?: string; hangoutLink?: string;
  attendees?: { email: string; responseStatus?: string }[];
  conferenceData?: {
    createRequest?: { status?: { statusCode?: string } };
    entryPoints?: { entryPointType?: string; uri?: string }[];
  };
};
/** Deterministic Google id makes a timeout/retry recover the same meeting.
 * Caller serializes each room's sync against guest changes. No private student
 * tokens appear in the shared event or in other attendees' invitations. */
export async function syncLiveCalendar(room: LiveLabRoom, emails: string[], instructorEmail: string) {
  const connector = new ReplitConnectors();
  const id = `lab${room.id.replaceAll('-', '')}`;
  const base = '/calendar/v3/calendars/primary/events';
  const path = `${base}/${id}`;
  const read = await connector.proxy('google-calendar', path, { method: 'GET' });
  let event: Event | undefined;
  if (read.ok) event = await read.json() as Event;
  else if (read.status !== 404) throw new Error('calendar_read_failed');
  if (event?.status === 'cancelled') throw new Error('calendar_event_cancelled');
  const uniqueEmails = [...new Set([...emails, instructorEmail].map(e => e.toLowerCase()))];
  const attendees = uniqueEmails.map(email => ({
    email, ...(event?.attendees?.find(a => a.email.toLowerCase() === email)?.responseStatus
      ? { responseStatus: event.attendees.find(a => a.email.toLowerCase() === email)!.responseStatus } : {}),
  }));
  const payload = {
    summary: `FunAdemy — ${room.title}`,
    description: 'Online free trial • Windmill BC.013\nتجربة مجانية مباشرة عبر Google Meet.\nYour instructor will share your private Windmill lab link separately. Please do not forward private student links.\nسيشارك المدرب رابط المختبر الخاص بك بشكل منفصل.',
    start: { dateTime: room.startsAt.toISOString(), timeZone: 'Asia/Riyadh' },
    end: { dateTime: new Date(room.startsAt.getTime() + room.durationMin * 60000).toISOString(), timeZone: 'Asia/Riyadh' },
    attendees, guestsCanInviteOthers: false, guestsCanModify: false, guestsCanSeeOtherGuests: false,
    visibility: 'private', reminders: { useDefault: false },
  };
  // Avoid re-emailing everyone on polling/retry once membership matches.
  const sameGuests = event && event.attendees?.length === attendees.length &&
    attendees.every(a => event!.attendees?.some(old => old.email.toLowerCase() === a.email));
  if (!event) {
    const result = await connector.proxy('google-calendar', `${base}?conferenceDataVersion=1&sendUpdates=all`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload, conferenceData: { createRequest: { requestId: id, conferenceSolutionKey: { type: 'hangoutsMeet' } } } }),
    });
    if (result.status === 409) {
      // A previous request reached Google but its database commit/response was lost.
      const recovered = await connector.proxy('google-calendar', path, { method: 'GET' });
      if (!recovered.ok) throw new Error('calendar_recovery_failed');
      event = await recovered.json() as Event;
    } else {
      if (!result.ok) throw new Error('calendar_create_failed');
      event = await result.json() as Event;
    }
  }
  // Recompute against a recovered 409 event too: the earlier request might
  // have contained an older guest list before its outcome was known locally.
  const finalGuestsMatch = event?.attendees?.length === attendees.length &&
    attendees.every(a => event!.attendees?.some(old => old.email.toLowerCase() === a.email));
  if (!sameGuests && !finalGuestsMatch) {
    const result = await connector.proxy('google-calendar', `${path}?conferenceDataVersion=1&sendUpdates=all`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    if (!result.ok) throw new Error('calendar_update_failed');
    event = await result.json() as Event;
  }
  if (event?.conferenceData?.createRequest?.status?.statusCode === 'failure') throw new Error('meet_creation_failed');
  const raw = event?.hangoutLink ?? event?.conferenceData?.entryPoints?.find(p => p.entryPointType === 'video')?.uri;
  let meetUrl: string | null = null;
  if (raw) {
    const parsed = new URL(raw);
    if (parsed.protocol === 'https:' && parsed.hostname === 'meet.google.com') meetUrl = parsed.href;
  }
  return { meetUrl };
}
