/**
 * Appointment scheduling core — consultation availability windows and
 * trial-class date resolution. All wall-clock values are Riyadh local
 * (UTC+3, no DST); stored timestamps are UTC.
 */
import { prisma } from '@/lib/db';

export const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;
export const CONSULT_DURATION_MIN = 30;

/** Consultation windows: Sunday–Thursday, 16:00–20:00 Riyadh, 30-min slots. */
const CONSULT_WEEKDAYS = [0, 1, 2, 3, 4]; // 0=Sunday..6=Saturday (JS getUTCDay: 0=Sunday)
const CONSULT_START_HOUR = 16;
const CONSULT_END_HOUR = 20;
const CONSULT_DAYS_AHEAD = 14;
const MIN_LEAD_MS = 3 * 60 * 60 * 1000; // at least 3h notice

/** UTC Date for a Riyadh-local wall time. */
export function riyadhDateTime(year: number, month: number, day: number, hour: number, minute: number): Date {
  return new Date(Date.UTC(year, month, day, hour, minute) - RIYADH_OFFSET_MS);
}

/** Next concrete occurrence (UTC) of a recurring weekday/time slot, Riyadh local. 0=Sunday..6=Saturday. */
export function nextOccurrence(weekday: number, time: string, from = new Date()): Date {
  const [h, m] = time.split(':').map(Number);
  const local = new Date(from.getTime() + RIYADH_OFFSET_MS); // Riyadh wall clock as fake-UTC
  for (let add = 0; add < 8; add++) {
    const cand = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + add, h, m));
    if (cand.getUTCDay() !== weekday) continue;
    const utc = new Date(cand.getTime() - RIYADH_OFFSET_MS);
    if (utc.getTime() > from.getTime()) return utc;
  }
  // Mathematically unreachable, but fail loudly rather than return a stale date.
  throw new Error(`no upcoming occurrence for weekday=${weekday} time=${time}`);
}

export type ConsultSlot = { startsAt: string }; // ISO UTC

/** All open consultation slots for the next two weeks, minus booked ones. */
export async function consultAvailability(now = new Date()): Promise<ConsultSlot[]> {
  // Slots are generated for day offsets 0..CONSULT_DAYS_AHEAD, so the last
  // day's evening slots can start after now+14d. Fetch booked appointments a
  // day beyond that, or a booked horizon-edge slot would still be offered.
  const horizon = new Date(now.getTime() + (CONSULT_DAYS_AHEAD + 1) * 24 * 60 * 60 * 1000);
  const booked = await prisma.appointment.findMany({
    where: { kind: 'consult', status: 'scheduled', startsAt: { gte: now, lte: horizon } },
    select: { startsAt: true },
  });
  const taken = new Set(booked.map((b) => b.startsAt.getTime()));

  const slots: ConsultSlot[] = [];
  const local = new Date(now.getTime() + RIYADH_OFFSET_MS);
  for (let add = 0; add <= CONSULT_DAYS_AHEAD; add++) {
    const day = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + add));
    if (!CONSULT_WEEKDAYS.includes(day.getUTCDay())) continue;
    for (let hour = CONSULT_START_HOUR; hour < CONSULT_END_HOUR; hour++) {
      for (const minute of [0, 30]) {
        const utc = riyadhDateTime(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), hour, minute);
        if (utc.getTime() - now.getTime() < MIN_LEAD_MS) continue;
        if (taken.has(utc.getTime())) continue;
        slots.push({ startsAt: utc.toISOString() });
      }
    }
  }
  return slots;
}

const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const EN_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Human-readable Riyadh-local date/time for messages. */
export function formatRiyadh(d: Date, lang: 'ar' | 'en' = 'ar'): string {
  const local = new Date(d.getTime() + RIYADH_OFFSET_MS);
  const day = (lang === 'ar' ? AR_DAYS : EN_DAYS)[local.getUTCDay()];
  const dd = local.getUTCDate();
  const mm = local.getUTCMonth() + 1;
  const yyyy = local.getUTCFullYear();
  let h = local.getUTCHours();
  const min = String(local.getUTCMinutes()).padStart(2, '0');
  const pm = h >= 12;
  h = h % 12 || 12;
  const ampm = lang === 'ar' ? (pm ? 'مساءً' : 'صباحاً') : pm ? 'PM' : 'AM';
  return `${day} ${dd}/${mm}/${yyyy} — ${h}:${min} ${ampm}`;
}
