'use client';
import { WEEKDAYS_SHORT_EN, arabicDigits } from '@/lib/constants';

interface TickerSlot {
  id: number;
  weekday: number;
  time: string;
  seatsLeft: number;
  capacity: number;
  program: {
    nameEn: string;
    nameAr: string;
    format: string;
  };
  location: string | null;
}

export function LiveTicker({ slots, lang }: { slots: TickerSlot[]; lang: 'ar' | 'en' }) {
  if (slots.length === 0) return null;

  // We loop the slots multiple times to create a seamless marquee
  const loopedSlots = [...slots, ...slots, ...slots, ...slots];

  const getDay = (w: number) => {
    if (lang === 'ar') {
      const arDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      return arDays[w];
    }
    return WEEKDAYS_SHORT_EN[w];
  };

  const formatSeats = (left: number, isWaitlist: boolean) => {
    if (isWaitlist) return lang === 'ar' ? '[ممتلئ — قائمة انتظار]' : '[full — waitlist]';
    if (lang === 'ar') {
      return `[${arabicDigits(left)} مقاعد متبقية]`;
    }
    return `[${left} seats left]`;
  };

  return (
    <div className="live">
      <div className="wrap">
        <div className="tag">
          <span className="dot"></span>
          {lang === 'ar' ? 'مباشر هذا الأسبوع' : 'LIVE THIS WEEK'}
        </div>
        <div className="mq" dir="ltr">
          <div className="mq-in">
            {loopedSlots.map((s, i) => {
              const isWaitlist = s.seatsLeft <= 0;
              const seatsText = formatSeats(s.seatsLeft, isWaitlist);
              const loc = s.program.format === 'in_person' && s.location ? ` @ ${s.location}` : '';
              
              return (
                <span key={`${s.id}-${i}`}>
                  {getDay(s.weekday)} {s.time} — <b>{lang === 'ar' ? s.program.nameAr : s.program.nameEn}</b> {loc} {seatsText}
                </span>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
