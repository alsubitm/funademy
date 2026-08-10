'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import { consultDict } from '@/app/(ar)/consult/dict';
import { waLink, WEEKDAYS_AR, WEEKDAYS_EN } from '@/lib/constants';

const RIYADH_OFFSET_MS = 3 * 60 * 60 * 1000;

type Confirmed = { whenAr: string; whenEn: string; meetUrl: string | null; emailInvited: boolean };

function riyadhParts(iso: string) {
  const local = new Date(new Date(iso).getTime() + RIYADH_OFFSET_MS);
  const dayKey = `${local.getUTCFullYear()}-${String(local.getUTCMonth() + 1).padStart(2, '0')}-${String(local.getUTCDate()).padStart(2, '0')}`;
  let h = local.getUTCHours();
  const min = String(local.getUTCMinutes()).padStart(2, '0');
  const pm = h >= 12;
  h = h % 12 || 12;
  return { dayKey, weekday: local.getUTCDay(), dayNum: local.getUTCDate(), month: local.getUTCMonth() + 1, time: `${h}:${min}`, pm };
}

export function ConsultFlow({ lang }: { lang: 'ar' | 'en' }) {
  const d = consultDict[lang];
  const weekdays = lang === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN;
  const [slots, setSlots] = useState<string[] | null>(null);
  const [dayKey, setDayKey] = useState<string | null>(null);
  const [startsAt, setStartsAt] = useState<string | null>(null);
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [confirmed, setConfirmed] = useState<Confirmed | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadSlots = () => {
    fetch('/svc/appointments/availability')
      .then((r) => r.json())
      .then((data) => setSlots((data.slots ?? []).map((s: { startsAt: string }) => s.startsAt)))
      .catch(() => setSlots([]));
  };
  useEffect(loadSlots, []);

  const days = useMemo(() => {
    const map = new Map<string, { weekday: number; dayNum: number; month: number; times: string[] }>();
    for (const iso of slots ?? []) {
      const p = riyadhParts(iso);
      if (!map.has(p.dayKey)) map.set(p.dayKey, { weekday: p.weekday, dayNum: p.dayNum, month: p.month, times: [] });
      map.get(p.dayKey)!.times.push(iso);
    }
    return map;
  }, [slots]);

  const ampm = (pm: boolean) => (lang === 'ar' ? (pm ? 'م' : 'ص') : pm ? 'PM' : 'AM');

  const onSubmit = () => {
    setError('');
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!startsAt || !parentName || !/^(\+?966|0)?5\d{8}$/.test(cleanPhone)) {
      setError(d.valError);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch('/svc/appointments', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ startsAt, parentName, phone: cleanPhone, email: email.trim() || undefined, notes: notes.trim() || undefined }),
        });
        if (res.status === 201) {
          const data = await res.json();
          setConfirmed({ whenAr: data.whenAr, whenEn: data.whenEn, meetUrl: data.meetUrl, emailInvited: data.emailInvited });
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (res.status === 409) {
          setError(d.slotGone);
          setStartsAt(null);
          loadSlots();
        } else if (res.status === 502) {
          setError(d.calendarError);
        } else {
          setError(d.genericError);
        }
      } catch {
        setError(d.genericError);
      }
    });
  };

  if (confirmed) {
    const when = lang === 'ar' ? confirmed.whenAr : confirmed.whenEn;
    let msg = `${d.waMsg}\n${d.when}: ${when}`;
    if (confirmed.meetUrl) msg += `\n${d.join}: ${confirmed.meetUrl}`;
    return (
      <div className="w-box">
        <div className="success-box">
          <div className="icon">🎉</div>
          <h3>{d.successTitle}</h3>
          <div style={{ margin: '16px 0', padding: '14px', border: '1px solid var(--line)', borderRadius: '12px', textAlign: 'start' }}>
            <p style={{ margin: '4px 0' }}>🗓️ <b>{d.when}:</b> {when}</p>
            {confirmed.meetUrl && (
              <p style={{ margin: '4px 0' }}>
                🎥 <b>{d.join}:</b>{' '}
                <a href={confirmed.meetUrl} target="_blank" rel="noopener noreferrer" dir="ltr">{confirmed.meetUrl}</a>
              </p>
            )}
            {confirmed.emailInvited && <p style={{ margin: '4px 0' }}>{d.emailSent}</p>}
          </div>
          <a href={waLink(msg)} target="_blank" rel="noopener noreferrer" className="btn wa">{d.waBtn}</a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-box">
      <div className="w-body">
        {slots === null && <p>{d.loading}</p>}
        {slots !== null && days.size === 0 && <p>{d.noSlots}</p>}

        {days.size > 0 && (
          <>
            <h3 style={{ marginTop: 0 }}>{d.pickDay}</h3>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {[...days.entries()].map(([key, info]) => (
                <button
                  key={key}
                  className={`btn ${dayKey === key ? 'y' : 'ghost'}`}
                  style={{ minWidth: '86px', ...(dayKey === key ? {} : { color: 'var(--ink)', borderColor: 'var(--line)' }) }}
                  onClick={() => { setDayKey(key); setStartsAt(null); }}
                >
                  {weekdays[info.weekday]}<br />{info.dayNum}/{info.month}
                </button>
              ))}
            </div>

            {dayKey && (
              <>
                <h3>{d.pickTime}</h3>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {(days.get(dayKey)?.times ?? []).map((iso) => {
                    const p = riyadhParts(iso);
                    return (
                      <button key={iso} className={`btn ${startsAt === iso ? 'y' : 'ghost'}`} style={startsAt === iso ? undefined : { color: 'var(--ink)', borderColor: 'var(--line)' }} onClick={() => setStartsAt(iso)} dir="ltr">
                        {p.time} {ampm(p.pm)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {startsAt && (
              <>
                <h3>{d.yourDetails}</h3>
                <div className="form-grid">
                  <div className="f-group">
                    <label>{d.parentName}</label>
                    <input type="text" value={parentName} onChange={(e) => setParentName(e.target.value)} disabled={isPending} />
                  </div>
                  <div className="f-group">
                    <label>{d.mobile}</label>
                    <input type="tel" dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }} value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isPending} />
                  </div>
                  <div className="f-group">
                    <label>{d.email}</label>
                    <input type="email" dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }} value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} />
                  </div>
                  <div className="f-group">
                    <label>{d.notes}</label>
                    <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={isPending} />
                  </div>
                </div>
                <div className="w-acts" style={{ marginTop: '16px' }}>
                  <div />
                  <button className="btn y" onClick={onSubmit} disabled={isPending}>
                    {isPending ? d.submitting : d.submit}
                  </button>
                </div>
              </>
            )}
          </>
        )}
        {error && <p style={{ color: 'var(--red, #c0392b)', marginTop: '12px' }}>{error}</p>}
      </div>
    </div>
  );
}
