import type { InstructorDashboardData } from '@/lib/instructor-types';
export type Lang = 'ar' | 'en';

export type Dashboard = InstructorDashboardData;
export type Viewer = Dashboard['viewer'];
export type Run = Dashboard['runs'][number];
export type Student = Run['students'][number];
export type Session = Run['sessions'][number];
export type Attendance = Session['attendance'][number];

export const TZ = 'Asia/Riyadh';

export function dayKey(iso: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
}
export function fmtDate(iso: string, lang: Lang, opts: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }) {
  try { return new Intl.DateTimeFormat(lang === 'ar' ? 'ar-SA-u-ca-gregory-nu-latn' : 'en-GB', { timeZone: TZ, ...opts }).format(new Date(iso)); }
  catch { return iso; }
}
