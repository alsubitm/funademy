import { EXHIBITION_DATE_ISO } from '@/lib/constants';

/** Pure helpers shared by server (initial HTML) and client tickers. */
export type TimeLeft = { d: number; h: number; m: number; s: number; passed: boolean };

export function daysUntilExhibition(now: number = Date.now()): number {
  return Math.max(0, Math.ceil((new Date(EXHIBITION_DATE_ISO).getTime() - now) / 86400000));
}

export function computeLeft(now: number = Date.now()): TimeLeft {
  const diff = new Date(EXHIBITION_DATE_ISO).getTime() - now;
  if (diff <= 0) return { d: 0, h: 0, m: 0, s: 0, passed: true };
  return {
    d: Math.floor(diff / 86400000),
    h: Math.floor((diff / 3600000) % 24),
    m: Math.floor((diff / 60000) % 60),
    s: Math.floor((diff / 1000) % 60),
    passed: false,
  };
}
