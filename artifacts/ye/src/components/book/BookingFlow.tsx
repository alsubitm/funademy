'use client';

import { useState, useTransition } from 'react';
import { bookDict } from '@/app/book/dict';
import { NEIGHBORHOODS, waLink, WEEKDAYS_AR, WEEKDAYS_EN } from '@/lib/constants';

type BookingFlowProps = {
  programs: any[];
  slots: any[];
  lang: 'ar' | 'en';
  preselectProgramSlug?: string;
};

export function BookingFlow({ programs, slots, lang, preselectProgramSlug }: BookingFlowProps) {
  const d = bookDict[lang];
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [isPending, startTransition] = useTransition();

  // State
  const [programId, setProgramId] = useState<number | null>(() => {
    if (preselectProgramSlug) {
      const p = programs.find((p) => p.slug === preselectProgramSlug);
      if (p) return p.id;
    }
    return null;
  });
  const [slotId, setSlotId] = useState<number | null>(null);
  
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [childFirstName, setChildFirstName] = useState('');
  const [childBirthYear, setChildBirthYear] = useState('');
  const [neighborhood, setNeighborhood] = useState('');
  
  const [error, setError] = useState('');

  // Derived
  const filteredSlots = slots.filter((s) => s.programId === programId);
  const selectedProgram = programs.find(p => p.id === programId);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 14 }, (_, i) => currentYear - 16 + i).reverse();
  const weekdays = lang === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN;

  const nextStep = () => {
    setError('');
    if (step === 1 && !programId) {
      setError(d.valError);
      return;
    }
    if (step === 2 && !slotId) {
      setError(d.valError);
      return;
    }
    setStep((s) => (s + 1) as 1 | 2 | 3 | 4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const prevStep = () => {
    setError('');
    setStep((s) => (s - 1) as 1 | 2 | 3 | 4);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const onSubmit = () => {
    setError('');
    if (!parentName || !phone || !childFirstName || !childBirthYear || !neighborhood) {
      setError(d.valError);
      return;
    }
    
    // validate phone (starts with 05 or +9665)
    const cleanPhone = phone.replace(/[\s-]/g, '');
    if (!/^(\+?966|0)?5\d{8}$/.test(cleanPhone)) {
      setError(d.valError);
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch('/svc/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            programId,
            slotId,
            parentName,
            phone: cleanPhone,
            childFirstName,
            childBirthYear: Number(childBirthYear),
            neighborhood,
          }),
        });

        if (res.status === 201) {
          setStep(4);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (res.status === 409 || res.status === 404) {
          setError(d.slotFullError);
          setSlotId(null);
          setStep(2);
        } else {
          setError(d.genericError);
        }
      } catch (err) {
        setError(d.genericError);
      }
    });
  };

  const confirmWaLink = () => {
    const msg = `${d.confirmMsg} (${childFirstName}) - ${selectedProgram?.nameAr || selectedProgram?.nameEn}`;
    return waLink(msg);
  };

  const waitlistWaLink = (programName: string) => {
    return waLink(`${d.waitlistMsg} ${programName}`);
  };

  if (step === 4) {
    return (
      <div className="w-box">
        <div className="success-box">
          <div className="icon">🎉</div>
          <h3>{d.successTitle}</h3>
          <p>{d.successDesc}</p>
          <a href={confirmWaLink()} target="_blank" rel="noopener noreferrer" className="btn wa">
            {d.successWaBtn}
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="w-box">
      <div className="w-header">
        <div className="w-steps">
          <div className={`w-step ${step === 1 ? 'active' : step > 1 ? 'done' : ''}`}>{d.step1}</div>
          <div className={`w-step ${step === 2 ? 'active' : step > 2 ? 'done' : ''}`}>{d.step2}</div>
          <div className={`w-step ${step === 3 ? 'active' : ''}`}>{d.step3}</div>
        </div>
        {step === 1 && <h3>{d.selectProgram}</h3>}
        {step === 2 && <h3>{d.selectSlot}</h3>}
        {step === 3 && <h3>{d.fillDetails}</h3>}
      </div>

      {error && <div className="err-box">{error}</div>}

      <div className="w-content">
        {step === 1 && (
          <div className="prog-grid">
            {programs.map((p) => {
              const isSelected = p.id === programId;
              return (
                <div key={p.id} className={`prog-card ${isSelected ? 'sel' : ''}`} onClick={() => { setProgramId(p.id); setSlotId(null); }}>
                  <div className="check">✓</div>
                  <div className="p-code">{p.kitCode}</div>
                  <h4>{lang === 'ar' ? p.nameAr : p.nameEn}</h4>
                  <div className="p-age">{d.ageRange} {p.ageMin}-{p.ageMax} {d.years}</div>
                </div>
              );
            })}
          </div>
        )}

        {step === 2 && (
          <div className="slot-list">
            {filteredSlots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--mut)' }}>
                No slots available right now.
              </div>
            ) : null}
            {filteredSlots.map((s) => {
              const isFull = s.seatsLeft <= 0;
              const isSelected = s.id === slotId;
              const fmtLabel = s.format === 'online' ? d.online : d.inPerson;
              return (
                <div 
                  key={s.id} 
                  className={`slot-item ${isSelected ? 'sel' : ''} ${isFull ? 'full' : ''}`}
                  onClick={() => !isFull && setSlotId(s.id)}
                >
                  <div className="slot-main">
                    <div className="slot-time">{weekdays[s.weekday]} — {s.time}</div>
                    <div className="slot-meta">
                      <span className={`slot-fmt ${s.format}`}>{fmtLabel}</span>
                      {s.location && <span>📍 {s.location}</span>}
                    </div>
                  </div>
                  <div className="slot-action">
                    {isFull ? (
                      <>
                        <div className="slot-seats">{d.fullSlot}</div>
                        <a href={waitlistWaLink(lang === 'ar' ? selectedProgram?.nameAr || '' : selectedProgram?.nameEn || '')} target="_blank" rel="noopener noreferrer" className="btn" onClick={e => e.stopPropagation()}>WhatsApp</a>
                      </>
                    ) : (
                      <div className="slot-seats"><b>{s.seatsLeft}</b> {d.seatsLeft}</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {step === 3 && (
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
              <label>{d.childName}</label>
              <input type="text" value={childFirstName} onChange={(e) => setChildFirstName(e.target.value)} disabled={isPending} />
            </div>
            <div className="f-group">
              <label>{d.birthYear}</label>
              <select value={childBirthYear} onChange={(e) => setChildBirthYear(e.target.value)} disabled={isPending}>
                <option value="">--</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="f-group" style={{ gridColumn: '1 / -1' }}>
              <label>{d.neighborhood}</label>
              <select value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} disabled={isPending}>
                <option value="">--</option>
                {NEIGHBORHOODS.map(n => <option key={n.id} value={n.id}>{lang === 'ar' ? n.ar : n.en}</option>)}
              </select>
              {neighborhood === 'other' && (
                <div className="alert-box">{d.otherHoodAlert}</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="w-acts">
        {step > 1 ? (
          <button className="btn ghost" style={{ color: 'var(--mut)', borderColor: 'var(--line)' }} onClick={prevStep} disabled={isPending}>{d.back}</button>
        ) : <div />}
        
        {step < 3 ? (
          <button className="btn y" onClick={nextStep}>{d.continue}</button>
        ) : (
          <button className="btn y" onClick={onSubmit} disabled={isPending}>
            {isPending ? d.submitting : d.submit}
          </button>
        )}
      </div>
    </div>
  );
}
