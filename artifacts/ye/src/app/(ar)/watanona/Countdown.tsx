'use client';

import { useState, useEffect } from 'react';
import { EXHIBITION_DATE_ISO, arabicDigits } from '@/lib/constants';
import { watanonaDict } from './dictionary';

export function Countdown({ lang }: { lang: 'ar' | 'en' }) {
  const d = watanonaDict[lang];
  const [timeLeft, setTimeLeft] = useState({ d: 0, h: 0, m: 0, s: 0, passed: false });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const target = new Date(EXHIBITION_DATE_ISO).getTime();
    
    const tick = () => {
      const now = Date.now();
      const diff = target - now;
      
      if (diff <= 0) {
        setTimeLeft(prev => ({ ...prev, passed: true }));
        return;
      }
      
      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff / (1000 * 60 * 60)) % 24),
        m: Math.floor((diff / 1000 / 60) % 60),
        s: Math.floor((diff / 1000) % 60),
        passed: false
      });
    };
    
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!mounted) return <div className="countdown" style={{ opacity: 0 }}>...</div>;

  if (timeLeft.passed) {
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
        <div className="cd-val">{format(timeLeft.d)}</div>
        <div className="cd-lbl">{d.cdDays}</div>
      </div>
      <div className="cd-box">
        <div className="cd-val">{format(timeLeft.h)}</div>
        <div className="cd-lbl">{d.cdHours}</div>
      </div>
      <div className="cd-box">
        <div className="cd-val">{format(timeLeft.m)}</div>
        <div className="cd-lbl">{d.cdMins}</div>
      </div>
      <div className="cd-box">
        <div className="cd-val">{format(timeLeft.s)}</div>
        <div className="cd-lbl">{d.cdSecs}</div>
      </div>
    </div>
  );
}
