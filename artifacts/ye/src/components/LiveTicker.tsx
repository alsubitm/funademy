'use client';
import { WEEKDAYS_SHORT_EN } from '@/lib/constants';

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

  const getDay = (w: number) => {
    if (lang === 'ar') {
      const arDays = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
      return arDays[w];
    }
    return WEEKDAYS_SHORT_EN[w];
  };

  return (
    <section className="sec live-board-section" id="schedule">
      <div className="wrap">
        <div className="sec-head" style={{ textAlign: 'center' }}>
          <span className="kick">LIVE LABS · 01</span>
          <h2>{lang === 'ar' ? 'حصص هذا الأسبوع — حضور في الرياض، وSkyLab أونلاين' : 'This week — Riyadh classrooms and SkyLab online'}</h2>
          <p className="sub" style={{ marginInline: 'auto' }}>
            {lang === 'ar' ? 'المقاعد تتغير مباشرة. اختر المختبر المناسب واحجز تجربتك.' : 'Seats update live. Find the right lab and reserve a trial.'}
          </p>
        </div>
        <div className="board" role="table" aria-label={lang === 'ar' ? 'جدول المختبرات' : 'Live labs schedule'}>
          <div className="bhead" role="row">
            <span>{lang === 'ar' ? 'الحالة' : 'STATUS'}</span>
            <span>{lang === 'ar' ? 'المقاعد' : 'SEATS'}</span>
            <span>{lang === 'ar' ? 'المختبر' : 'LAB'}</span>
            <span>{lang === 'ar' ? 'الوقت' : 'TIME'}</span>
            <span className="gate">{lang === 'ar' ? 'المكان' : 'STEM · WHERE'}</span>
          </div>
          {slots.map((s) => {
            const wait = s.seatsLeft <= 0;
            const loc = s.program.format === 'in_person' && s.location ? s.location : 'ONLINE';
            return (
              <div className="row" role="row" key={s.id}>
                <span className={`st ${wait ? 'last' : ''}`}>{wait ? (lang === 'ar' ? 'آخر المقاعد' : 'LAST SEATS') : (lang === 'ar' ? 'مفتوح' : 'OPEN')}</span>
                <span className="flap" dir="ltr">{String(Math.max(0, s.seatsLeft)).padStart(2, '0').split('').map((n, i) => <span key={i}>{n}</span>)}</span>
                <span>{s.program.nameEn}</span>
                <span dir="ltr">{getDay(s.weekday)} {s.time}</span>
                <span className="gate">{loc}</span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
