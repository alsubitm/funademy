/** Shared course-run schedule helpers (single and batch admin creation). */

export function isValidTime(t: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(t)) return false;
  const [h, m] = t.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

export function isHttpUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Generate weekly session dates. `time` is Riyadh local (UTC+3); stored as UTC — same convention as prisma/seed.ts. */
export function weeklyDates(start: Date, end: Date, weekday: number, time: string): Date[] {
  const [h, m] = time.split(':').map(Number);
  const dates: Date[] = [];
  const d = new Date(start);
  // JS getUTCDay(): 0=Sunday — matches our weekday convention (date-only inputs parse as UTC midnight).
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1);
  while (d <= end) {
    // store Riyadh local time as UTC (UTC+3, no DST)
    dates.push(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), (h ?? 17) - 3, m ?? 0)));
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return dates;
}
