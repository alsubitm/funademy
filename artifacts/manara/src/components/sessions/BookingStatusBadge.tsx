import React from 'react';
import { useI18n } from '@/lib/i18n';
import { Badge } from '@/components/ui/badge';
import type { BookingStatus } from './types';

const MAP: Record<
  BookingStatus,
  { ar: string; en: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  booked: { ar: 'محجوزة', en: 'Booked', variant: 'default' },
  waitlisted: { ar: 'قائمة الانتظار', en: 'Waitlisted', variant: 'secondary' },
  attended: { ar: 'تمت المشاركة', en: 'Attended', variant: 'outline' },
  cancelled: { ar: 'ملغاة', en: 'Cancelled', variant: 'destructive' },
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const { lang } = useI18n();
  const info = MAP[status] ?? { ar: status, en: status, variant: 'outline' as const };
  return <Badge variant={info.variant}>{lang === 'ar' ? info.ar : info.en}</Badge>;
}
