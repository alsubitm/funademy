'use client';

import { useEffect, useState, useTransition } from 'react';
import { bookDict } from '@/app/(ar)/book/dict';
import { waLink, WEEKDAYS_AR, WEEKDAYS_EN } from '@/lib/constants';
import { getSavedAge, saveAge } from '@/lib/savedAge';
import { AccountFlow } from '@/components/account/AccountFlow';
import '@/app/(ar)/account/page.css';

type BookingFlowProps = {
  programs: any[];
  slots: any[];
  lang: 'ar' | 'en';
  preselectProgramSlug?: string;
  preselectAge?: number;
};

export function BookingFlow({ programs, slots, lang, preselectProgramSlug, preselectAge }: BookingFlowProps) {
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
  const [ageFilter, setAgeFilterState] = useState<number | null>(preselectAge ?? null);

  // Fall back to the age remembered from other pages (sessionStorage);
  // an explicit ?age= in the URL takes priority.
  useEffect(() => {
    if (preselectAge != null) {
      saveAge(preselectAge);
      return;
    }
    const saved = getSavedAge();
    if (saved !== null) setAgeFilterState(saved);
  }, [preselectAge]);

  const setAgeFilter = (a: number | null) => {
    setAgeFilterState(a);
    saveAge(a);
  };
  const [formatFilter, setFormatFilter] = useState<'all' | 'online' | 'in_person'>('all');
  
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [childFirstName, setChildFirstName] = useState('');
  const [childBirthYear, setChildBirthYear] = useState('');
  const [email, setEmail] = useState('');
  const [contactConsent, setContactConsent] = useState(false);
  const neighborhood = 'riyadh';
  const [appointment, setAppointment] = useState<{
    startsAt: string;
    meetUrl: string | null;
    whenAr: string;
    whenEn: string;
  } | null>(null);
  
  const [error, setError] = useState('');
  const [verified, setVerified] = useState(false);

  // Derived
  const programSlots = slots.filter((s) => s.programId === programId);
  const hasBothFormats = new Set(programSlots.map((s) => s.format)).size > 1;
  const filteredSlots = programSlots.filter((s) => formatFilter === 'all' || s.format === formatFilter);
  const selectedProgram = programs.find(p => p.id === programId);
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear - 18 + i).reverse();
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
    if (!parentName || !phone || !childFirstName || !childBirthYear || !contactConsent || !email.trim()) {
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
            email: email.trim() || undefined,
            contactChannel: 'email',
            contactConsent,
          }),
        });

        const data = await res.json().catch(() => null);
        if (res.status === 201) {
          setAppointment(data?.appointment ?? null);
          setStep(4);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else if (data?.error === 'slot_full' || data?.error === 'slot_not_found') {
          setError(d.slotFullError);
          setSlotId(null);
          setStep(2);
        } else if (res.status === 401) {
          setVerified(false);
        } else if (data?.error === 'trial_limit' || data?.error === 'rate_limited') {
          setError(lang === 'ar' ? 'تم بلوغ حد الحجز. يرجى المحاولة لاحقاً.' : 'Booking limit reached. Please try again later.');
        } else {
          setError(d.genericError);
        }
      } catch (err) {
        setError(d.genericError);
      }
    });
  };

  const confirmWaLink = () => {
    let msg = `${d.confirmMsg} (${childFirstName}) - ${selectedProgram?.nameEn}`;
    if (appointment) {
      msg += `\n${d.apptWhen}: ${lang === 'ar' ? appointment.whenAr : appointment.whenEn}`;
      if (appointment.meetUrl) msg += `\n${d.apptJoin}: ${appointment.meetUrl}`;
    }
    return waLink(msg);
  };

  const waitlistWaLink = (programName: string) => {
    return waLink(`${d.waitlistMsg} ${programName}`);
  };

  if (!verified) {
    return <div className="acct-pg">
      <p>{lang === 'ar' ? 'يرجى تأكيد رقم الجوال لحجز مقعد تجريبي.' : 'Please verify your phone number to reserve a trial seat.'}</p>
      <AccountFlow lang={lang} onAuthenticated={(family) => {
        setPhone(family.phone);
        setParentName(family.parentName);
        setVerified(true);
      }} />
    </div>;
  }

  if (step === 4) {
    return (
      <div className="w-box">
        <div className="success-box">
          <div className="icon">🎉</div>
          <h3>{d.successTitle}</h3>
          <p>{d.successDesc}</p>
          {appointment ? (
            <div className="appt-box" style={{ margin: '16px 0', padding: '14px', border: '1px solid var(--line)', borderRadius: '12px', textAlign: 'start' }}>
              <p style={{ margin: '4px 0' }}>
                🗓️ <b>{d.apptWhen}:</b> {lang === 'ar' ? appointment.whenAr : appointment.whenEn}
              </p>
              {appointment.meetUrl && (
                <p style={{ margin: '4px 0' }}>
                  🎥 <b>{d.apptJoin}:</b>{' '}
                  <a href={appointment.meetUrl} target="_blank" rel="noopener noreferrer" dir="ltr">
                    {appointment.meetUrl}
                  </a>
                </p>
              )}
              {email.trim() && <p style={{ margin: '4px 0' }}>{d.apptEmailSent}</p>}
            </div>
          ) : (
            <p>{d.apptPending}</p>
          )}
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
        {/* WCAG 1.3.1: step indicators as semantic ordered list with aria-current */}
        <ol className="w-steps" aria-label={lang === 'ar' ? 'خطوات الحجز' : 'Booking steps'}>
          {[d.step1, d.step2, d.step3].map((label, i) => (
            <li
              key={i}
              className={`w-step ${step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''}`}
              aria-current={step === i + 1 ? 'step' : undefined}
            >
              {label}
            </li>
          ))}
        </ol>
        {step === 1 && <h3>{d.selectProgram}</h3>}
        {step === 2 && <h3>{d.selectSlot}</h3>}
        {step === 3 && <h3>{d.fillDetails}</h3>}
      </div>

      {error && <div className="err-box">{error}</div>}

      <div className="w-content">
        {step === 1 && (
          <>
          <div className="fmt-question">
            <span className="fmt-q-label">{lang === 'ar' ? 'كم عمر طفلك؟' : 'How old is your child?'}</span>
            <div className="fmt-q-opts" style={{ flexWrap: 'wrap' }}>
              <button type="button" className={`fmt-q-btn ${ageFilter === null ? 'sel' : ''}`} onClick={() => setAgeFilter(null)}>
                {lang === 'ar' ? 'الكل' : 'All'}
              </button>
              {Array.from({ length: 15 }, (_, i) => i + 4).map((a) => (
                <button key={a} type="button" className={`fmt-q-btn ${ageFilter === a ? 'sel' : ''}`} onClick={() => setAgeFilter(a)}>
                  {a}
                </button>
              ))}
            </div>
          </div>
          <div className="prog-grid">
            {programs.filter((p) => ageFilter === null || (ageFilter >= p.ageMin && ageFilter <= p.ageMax) || p.id === programId).map((p) => {
              const isSelected = p.id === programId;
              return (
                <button
                  key={p.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={`prog-card ${isSelected ? 'sel' : ''}`}
                  onClick={() => { setProgramId(p.id); setSlotId(null); }}
                >
                  <div className="check">✓</div>
                  <div className="p-code">{p.kitCode}</div>
                  <h4>{p.nameEn}</h4>
                  <div className="p-age">{d.ageRange} {p.ageMin}-{p.ageMax} {d.years}</div>
                </button>
              );
            })}
          </div>
          </>
        )}

        {step === 2 && hasBothFormats && (
          <div className="fmt-question">
            <span className="fmt-q-label">{d.formatQ}</span>
            <div className="fmt-q-opts">
              {(['all', 'online', 'in_person'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  className={`fmt-q-btn ${formatFilter === f ? 'sel' : ''}`}
                  onClick={() => { setFormatFilter(f); setSlotId(null); }}
                >
                  {f === 'all' ? d.formatAll : f === 'online' ? d.online : d.inPerson}
                </button>
              ))}
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="slot-list">
            {filteredSlots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--mut)' }}>
                <p>{d.noSlots}</p>
                <button type="button" className="btn" style={{ marginTop: 14 }} onClick={() => window.location.reload()}>
                  {d.refreshSlots}
                </button>
              </div>
            ) : null}
            {filteredSlots.map((s) => {
              const isFull = s.seatsLeft <= 0;
              const isSelected = s.id === slotId;
              const fmtLabel = s.format === 'online' ? d.online : d.inPerson;
              const slotInfo = (
                <>
                  <div className="slot-main">
                    <div className="slot-time">{weekdays[s.weekday]} — {s.time}</div>
                    <div className="slot-meta">
                      <span className={`slot-fmt ${s.format}`}>{fmtLabel}</span>
                      {s.location && <span>📍 {s.location}</span>}
                    </div>
                  </div>
                  <div className="slot-action">
                    <div className="slot-seats">
                      {isFull ? d.fullSlot : <><b>{s.seatsLeft}</b> {d.seatsLeft}</>}
                    </div>
                  </div>
                </>
              );
              if (isFull) {
                return (
                  <div key={s.id} className="slot-item full">
                    {slotInfo}
                    <a
                      href={waitlistWaLink(selectedProgram?.nameEn || '')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                    >
                      {d.askAvailability}
                    </a>
                  </div>
                );
              }
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={isSelected}
                  className={`slot-item ${isSelected ? 'sel' : ''}`}
                  onClick={() => setSlotId(s.id)}
                >
                  {slotInfo}
                </button>
              );
            })}
          </div>
        )}

        {step === 3 && (
          <div className="form-grid">
            <div className="f-group">
              <label htmlFor="book-parent-name">{d.parentName}</label>
              <input id="book-parent-name" type="text" value={parentName} onChange={(e) => setParentName(e.target.value)} disabled={isPending} />
            </div>
            <div className="f-group">
              <label htmlFor="book-mobile">{d.mobile}</label>
              <input id="book-mobile" type="tel" dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }} value={phone} readOnly disabled={isPending} />
            </div>
            <div className="f-group">
              <label htmlFor="book-child-name">{d.childName}</label>
              <input id="book-child-name" type="text" value={childFirstName} onChange={(e) => setChildFirstName(e.target.value)} disabled={isPending} />
            </div>
            <div className="f-group">
              <label htmlFor="book-birth-year">{d.birthYear}</label>
              <select id="book-birth-year" value={childBirthYear} onChange={(e) => setChildBirthYear(e.target.value)} disabled={isPending}>
                <option value="">--</option>
                {years.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <div className="f-group">
              <label htmlFor="book-email">{d.email}</label>
              <input id="book-email" type="email" dir="ltr" style={{ textAlign: lang === 'ar' ? 'right' : 'left' }} value={email} onChange={(e) => setEmail(e.target.value)} disabled={isPending} />
            </div>
            <div className="f-group">
              <label>{d.contactChannel}</label>
              <div style={{ padding: '12px 14px', border: '1px solid var(--line)', borderRadius: 10 }}>{d.contactEmail}</div>
            </div>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, gridColumn: '1 / -1', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={contactConsent}
                onChange={(e) => setContactConsent(e.target.checked)}
                disabled={isPending}
                style={{ width: 18, height: 18, marginTop: 3 }}
              />
              <span>{d.contactConsent}</span>
            </label>
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
