const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

/** Calendar date in Asia/Riyadh (Saudi Arabia has a fixed UTC+03:00 offset). */
export function riyadhDateKey(now: Date = new Date()): string {
  return new Date(now.getTime() + RIYADH_OFFSET_MS).toISOString().slice(0, 10);
}

/** UTC instant at which the current Riyadh calendar day began. */
export function riyadhDayStart(now: Date = new Date()): Date {
  const key = riyadhDateKey(now);
  return new Date(`${key}T00:00:00+03:00`);
}

export function previousRiyadhDateKey(now: Date = new Date()): string {
  return riyadhDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}