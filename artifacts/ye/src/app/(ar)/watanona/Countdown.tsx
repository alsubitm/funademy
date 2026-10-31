'use client';

import { useState, useEffect } from 'react';
import { arabicDigits } from '@/lib/constants';
import { computeLeft, type TimeLeft } from '@/lib/exhibition';
import { watanonaDict } from './dictionary';

export function Countdown({ lang, initial }: { lang: 'ar' | 'en'; initial?: TimeLeft }) {
  const d = watanonaDict[lang];
  const [timeTimeLeft, setTimeTimeLeft] = useState<TimeLeft>(() => initial ?? computeLeft());

  useEffect(() => {
    const tick = () => setTimeTimeLeft(computeLeft());
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);


  if (timeTimeLeft.passed) {
    return (
      <div className="countdown">
        <div className="cd-box"><div className="cd-val">{d.cdPassed}</div></div>
      </div>
    );
  }

  const format = (n: number) => lang === 'ar' ? arabicDigits(n) : n;

  return (
    <div className="countdown" dir="ltr">
      <div className="cd-box">
        <div className="cd-val">{format(timeTimeLeft.d)}</div>
        <div className="cd-lbl">{d.cdDays}</div>
      </div>
      <div className="cd-box">
        <div className="cd-val">{format(timeTimeLeft.h)}</div>
        <div className="cd-lbl">{d.cdHours}</div>
      </div>
      <div className="cd-box">
        <div className="cd-val">{format(timeTimeLeft.m)}</div>
        <div className="cd-lbl">{d.cdMins}</div>
      </div>
      <div className="cd-box">
        <div className="cd-val">{format(timeTimeLeft.s)}</div>
        <div className="cd-lbl">{d.cdSecs}</div>
      </div>
    </div>
  );
}
