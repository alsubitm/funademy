import React from 'react';
import { Link } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarClock, Users, User, Ticket, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDateTime, formatSar, type SessionView } from './types';

export function SessionPriceBadge({ session }: { session: SessionView }) {
  const { lang } = useI18n();
  const isFree = !session.priceSar || session.priceSar <= 0;
  if (isFree) {
    return <Badge variant="secondary">{lang === 'ar' ? 'مجانية' : 'Free'}</Badge>;
  }
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge variant="default">{formatSar(session.priceSar!, lang)}</Badge>
      {session.includedInSubscription && (
        <Badge variant="outline">{lang === 'ar' ? 'ضمن الاشتراك' : 'In subscription'}</Badge>
      )}
    </div>
  );
}

interface SessionCardProps {
  session: SessionView;
  onBook?: (session: SessionView) => void;
  booking?: boolean;
  disabledBook?: boolean;
  bookLabel?: string;
}

export function SessionCard({ session, onBook, booking, disabledBook, bookLabel }: SessionCardProps) {
  const { t, lang, dir } = useI18n();
  const ChevronForward = dir === 'rtl' ? ChevronLeft : ChevronRight;
  const full = session.seatsLeft <= 0;

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="h-1.5 w-full bg-primary" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg leading-snug">{session.title}</CardTitle>
          <SessionPriceBadge session={session} />
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 flex-1">
        <div className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 shrink-0 text-primary" />
            <span>{formatDateTime(session.startsAt, lang)}</span>
          </div>
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 shrink-0" />
            <span>{t('المعلّم', 'Teacher')} #{session.teacherId}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 shrink-0" />
            <span>
              {full
                ? t('الجلسة مكتملة — قائمة انتظار', 'Full — waitlist')
                : t(
                    `${session.seatsLeft} مقعد متبقٍ من ${session.capacity}`,
                    `${session.seatsLeft} of ${session.capacity} seats left`,
                  )}
            </span>
          </div>
        </div>

        {session.program && (
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md w-fit">
            {session.program}
          </span>
        )}

        <div className="mt-auto flex flex-col sm:flex-row gap-2 pt-2">
          {onBook && (
            <Button
              className="flex-1"
              variant={full ? 'outline' : 'default'}
              onClick={() => onBook(session)}
              disabled={booking || disabledBook}
            >
              <Ticket className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {bookLabel ?? (full ? t('انضم لقائمة الانتظار', 'Join waitlist') : t('احجز الآن', 'Book now'))}
            </Button>
          )}
          <Button variant="ghost" asChild className={onBook ? '' : 'flex-1 justify-between'}>
            <Link href={`/app/sessions/${session.id}`}>
              {t('التفاصيل', 'Details')}
              <ChevronForward className="w-4 h-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
