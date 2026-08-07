'use client';

import { useEffect, useState } from 'react';
import { EXHIBITION_DATE_ISO, arabicDigits } from '@/lib/constants';

/** Small live countdown chip to the Mini Watan exhibition (23 Sep 2027, 16:00 AST). */
export function CountdownChip({ lang }: { lang: 'ar' | 'en' }) {
  const [days, setDays] = useState<number | null>(null);

  useEffect(() => {
    const target = new Date(EXHIBITION_DATE_ISO).getTime();
    const tick = () => setDays(Math.max(0, Math.ceil((target - Date.now()) / 86400000)));
    tick();
    const id = setInterval(tick, 3600000);
    return () => clearInterval(id);
  }, []);

  if (days === null) return <span className="wt-chip">— {lang === 'ar' ? 'يوماً للمعرض' : 'days to go'}</span>;
  return (
    <span className="wt-chip">
      <i className="wt-dot" aria-hidden="true"></i>
      {lang === 'ar' ? `${arabicDigits(days)} يوماً حتى معرض وطن مصغّر` : `${days} days to the Mini Watan exhibition`}
    </span>
  );
}
