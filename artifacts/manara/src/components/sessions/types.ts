// Local TS interfaces derived from artifacts/api-server/src/routes/sessions.ts.
// The generated client returns AnyObject for many session endpoints, so we
// cast to these shapes locally.

export interface SessionView {
  id: number;
  seriesId: number | null;
  teacherId: number;
  title: string;
  description: string;
  program: string;
  startsAt: string;
  startsAtRiyadh?: string;
  durationMinutes: number;
  capacity: number;
  priceSar: number | null;
  includedInSubscription: boolean;
  status: string;
  bookedCount: number;
  seatsLeft: number;
}

export type BookingStatus = 'booked' | 'waitlisted' | 'attended' | 'cancelled';

export interface MyBooking {
  id: number;
  sessionId: number;
  userId: number;
  childId: number | null;
  status: BookingStatus;
  paymentMethod: string;
  paymentState: string;
  packageId: number | null;
  cancelledAt: string | null;
  createdAt: string;
  session: SessionView | null;
}

export interface SessionPackage {
  id: number;
  userId: number;
  name: string;
  totalCredits: number;
  remainingCredits: number;
  priceSar: number;
  paymentState: string;
  createdAt: string;
}

export interface SessionNotification {
  id: number;
  userId: number;
  sessionId: number | null;
  type: string;
  message: string;
  createdAt: string;
  readAt: string | null;
}

export interface SessionMaterial {
  id: number;
  sessionId: number;
  kind: string;
  title: string;
  url: string | null;
  content: string | null;
  createdAt: string;
}

export interface JoinLinkView {
  meetingLink: string;
  startsAt: string;
  durationMinutes: number;
}

/** Minimal shape of the ApiError thrown by the generated client. */
export interface ApiErrorLike {
  status?: number;
  data?: { message?: string; availableAt?: string } | null;
}

export function apiError(err: unknown): ApiErrorLike {
  return (err ?? {}) as ApiErrorLike;
}

/** SAR price fields in the backend are whole riyals (not halalas). */
export function formatSar(amount: number, lang: 'ar' | 'en'): string {
  const n = new Intl.NumberFormat(lang === 'ar' ? 'ar-SA' : 'en-US').format(amount);
  return lang === 'ar' ? `${n} ر.س` : `SAR ${n}`;
}

export function formatDateTime(iso: string, lang: 'ar' | 'en'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA' : 'en-US', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Asia/Riyadh',
  }).format(d);
}

export function formatCountdown(ms: number, lang: 'ar' | 'en'): string {
  if (ms <= 0) return lang === 'ar' ? 'الآن' : 'now';
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / 1440);
  const hours = Math.floor((totalMin % 1440) / 60);
  const mins = totalMin % 60;
  if (lang === 'ar') {
    const parts: string[] = [];
    if (days) parts.push(`${days} يوم`);
    if (hours) parts.push(`${hours} ساعة`);
    parts.push(`${mins} دقيقة`);
    return parts.join(' و');
  }
  const parts: string[] = [];
  if (days) parts.push(`${days}d`);
  if (hours) parts.push(`${hours}h`);
  parts.push(`${mins}m`);
  return parts.join(' ');
}
