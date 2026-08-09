import type { LiveSessionView } from '@workspace/api-client-react';

// ---------------------------------------------------------------------------
// Local types cast from AnyObject responses (see api-server/src/routes/sessions.ts)
// ---------------------------------------------------------------------------

export interface SessionSeries {
  id: number;
  title: string;
  description?: string;
  program?: string;
  teacherId?: number;
  createdAt?: string;
}

export interface SessionParticipant {
  bookingId: number;
  status: string; // booked | waitlisted | attended | cancelled
  paymentMethod: string; // free | subscription | package | single
  userName: string;
  childName: string | null;
  attendanceStatus: string | null; // present | absent | late | null
}

export interface SessionMaterial {
  id: number;
  sessionId: number;
  kind: string; // file | link | note
  title: string;
  url: string | null;
  content: string | null;
  createdAt?: string;
}

export type { LiveSessionView };

// ---------------------------------------------------------------------------
// Error helper — surface API messages (incl. 403 Forbidden) via toast
// ---------------------------------------------------------------------------

export function apiErrorMessage(err: unknown, isAr: boolean): string {
  const e = err as { status?: number; data?: { message?: string } } | undefined;
  const serverMsg = e?.data?.message;
  if (e?.status === 403) {
    return isAr
      ? 'ليست لديك صلاحية لإدارة هذه الجلسة'
      : 'You do not have permission to manage this session';
  }
  if (serverMsg) return serverMsg;
  return isAr ? 'حدث خطأ ما' : 'Something went wrong';
}

// ---------------------------------------------------------------------------
// Date/time helpers — the API accepts/returns ISO 8601 (UTC). The <input
// type="datetime-local"> works in local time; convert both ways.
// ---------------------------------------------------------------------------

/** ISO string → value usable by <input type="datetime-local"> (local time). */
export function isoToLocalInput(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** <input type="datetime-local"> value → ISO 8601 UTC string. */
export function localInputToIso(local: string): string {
  const d = new Date(local);
  return d.toISOString();
}

export function formatDateTime(iso: string | undefined, lang: 'ar' | 'en'): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(lang === 'ar' ? 'ar-SA' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

export function formatPrice(priceSar: number | null | undefined, lang: 'ar' | 'en'): string {
  if (priceSar == null || priceSar <= 0) {
    return lang === 'ar' ? 'مجانية' : 'Free';
  }
  return lang === 'ar' ? `${priceSar} ر.س` : `SAR ${priceSar}`;
}

export function isPast(session: LiveSessionView): boolean {
  const end = new Date(session.startsAt).getTime() + session.durationMinutes * 60_000;
  return end < Date.now();
}
