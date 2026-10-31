'use client';

import { useEffect, useState } from 'react';
import { arabicDigits } from '@/lib/constants';
import { daysUntilExhibition } from '@/lib/exhibition';

/** Small live countdown chip to the Mini Watan exhibition (23 Sep 2027, 16:00 Riyadh).
 *  `initialDays` is computed on the server so the first HTML already holds a real number. */
export function CountdownChip({ lang, initialDays }: { lang: 'ar' | 'en'; initialDays: number }) {
  const [days, setDays] = useState<number>(initialDays);

  useEffect(() => {
    const tick = () => setDays(daysUntilExhibition());
    tick();
    const id = setInterval(tick, 3600000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="wt-chip">
      <i className="wt-dot" aria-hidden="true"></i>
      {lang === 'ar' ? `${arabicDigits(days)} يوماً حتى معرض وطن مصغّر` : `${days} days to the Mini Watan exhibition`}
    </span>
  );
}
