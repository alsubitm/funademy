'use client';

import { useEffect, useState } from 'react';
import { accountDict } from '@/app/(ar)/account/dict';
import { arabicDigits } from '@/lib/constants';

type Lang = 'ar' | 'en';
type Student = { id: number; firstName: string; birthYear: number; nationalId: string | null };
type Me = { id: number; phone: string; parentName: string; students: Student[] };

const fmt = (lang: Lang, v: number | string) => (lang === 'ar' ? arabicDigits(v) : String(v));

/** Accept Arabic-Indic digits from Arabic keyboards. */
const toAscii = (raw: string) =>
  raw
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

export function AccountFlow({ lang }: { lang: Lang }) {
  const d = accountDict[lang];
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);

  // login state
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [parentName, setParentName] = useState('');
  const [isNew, setIsNew] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // children state
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [kidName, setKidName] = useState('');
  const [kidYear, setKidYear] = useState('');
  const [kidNid, setKidNid] = useState('');

  const errMsg = (key: string | null) => (key ? d.errors[key] ?? d.errors.generic : null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/svc/account/me', { cache: 'no-store' });
      if (res.status === 401) {
        setMe(null);
      } else if (!res.ok) {
        throw new Error(`account_refresh_${res.status}`);
      } else {
        setMe(await res.json());
      }
    } catch {
      setError('generic');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    refresh();
  }, []);

  async function sendCode() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/svc/account/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'generic');
      setIsNew(false);
      setDevCode(data.devCode ?? null);
      setStep('code');
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/svc/account/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, parentName, locale: lang }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'generic');
      if (data.needName) {
        // Valid code, new family — ask for the parent name (code not consumed).
        setIsNew(true);
        return;
      }
      setCode('');
      await refresh();
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/svc/account/logout', { method: 'POST' });
      if (!res.ok) throw new Error(`logout_${res.status}`);
      setMe(null);
      setStep('phone');
      setPhone('');
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  async function saveKid() {
    setBusy(true);
    setError(null);
    try {
      const url = editId ? `/svc/account/children/${editId}` : '/svc/account/children';
      const res = await fetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firstName: kidName, birthYear: Number(kidYear), nationalId: kidNid }),
      });
      const data = await res.json();
      if (!res.ok) return setError(data.error ?? 'generic');
      setShowAdd(false);
      setEditId(null);
      setKidName('');
      setKidYear('');
      setKidNid('');
      await refresh();
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  async function removeKid(id: number) {
    if (!window.confirm(d.confirmRemove)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/svc/account/children/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return setError(data.error ?? 'generic');
      }
      await refresh();
    } catch {
      setError('generic');
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="acct-box" aria-busy="true" />;
  if (error && !me) {
    return (
      <div className="acct-box">
        <div className="acct-err" role="alert">{errMsg(error)}</div>
        <button className="acct-btn primary" type="button" onClick={() => void refresh()}>
          {lang === 'ar' ? 'إعادة المحاولة' : 'Try again'}
        </button>
      </div>
    );
  }

  // ——— Logged in: children management ———
  if (me) {
    const year = new Date().getFullYear();
    return (
      <div className="acct-box">
        <div className="acct-head">
          <div>
            <h2>
              {d.welcome} {me.parentName} 👋
            </h2>
            <span className="a-phone">{me.phone}</span>
          </div>
          <button className="acct-btn ghost" onClick={logout} disabled={busy}>
            {d.logout}
          </button>
        </div>

        {error && <div className="acct-err" role="alert">{errMsg(error)}</div>}

        <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, marginBottom: 12 }}>
          {d.yourChildren}
        </h3>

        {me.students.length === 0 && !showAdd && <div className="acct-empty">{d.noChildren}</div>}

        <ul className="acct-kids">
          {me.students.map((s) => (
            <li key={s.id} className="acct-kid">
              <span className="k-avatar" aria-hidden>
                {s.firstName.slice(0, 1)}
              </span>
              <span className="k-info">
                <span className="k-name">{s.firstName}</span>
                <br />
                <span className="k-meta">
                  {fmt(lang, s.birthYear)} · {d.yearsOld(year - s.birthYear)}
                </span>
              </span>
              <span className="k-actions">
                <button
                  className="acct-btn ghost"
                  onClick={() => {
                    setEditId(s.id);
                    setKidName(s.firstName);
                    setKidYear(String(s.birthYear));
                    setKidNid(s.nationalId ?? '');
                    setShowAdd(true);
                  }}
                >
                  {d.edit}
                </button>
                <button className="acct-btn danger" onClick={() => removeKid(s.id)}>
                  {d.remove}
                </button>
              </span>
            </li>
          ))}
        </ul>

        {showAdd ? (
          <div>
            <div className="acct-form-row">
              <div className="acct-field">
                <label htmlFor="kid-name">{d.childName}</label>
                <input id="kid-name" value={kidName} onChange={(e) => setKidName(e.target.value)} maxLength={40} />
              </div>
              <div className="acct-field">
                <label htmlFor="kid-year">{d.birthYear}</label>
                <input
                  id="kid-year"
                  dir="ltr"
                  inputMode="numeric"
                  placeholder={String(year - 8)}
                  value={kidYear}
                  onChange={(e) => setKidYear(toAscii(e.target.value).replace(/\D/g, '').slice(0, 4))}
                />
              </div>
            </div>
            <div className="acct-field">
              <label htmlFor="kid-nid">{d.nationalIdLabel}</label>
              <input
                id="kid-nid"
                dir="ltr"
                inputMode="numeric"
                placeholder="1XXXXXXXXX"
                value={kidNid}
                onChange={(e) => setKidNid(toAscii(e.target.value).replace(/\D/g, '').slice(0, 10))}
              />
              <small style={{ opacity: 0.75 }}>{d.nationalIdHint}</small>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="acct-btn" style={{ width: 'auto' }} onClick={saveKid} disabled={busy || !kidName.trim() || kidYear.length !== 4}>
                {d.save}
              </button>
              <button
                className="acct-btn ghost"
                onClick={() => {
                  setShowAdd(false);
                  setEditId(null);
                  setKidName('');
                  setKidYear('');
                  setKidNid('');
                }}
              >
                {d.cancel}
              </button>
            </div>
          </div>
        ) : (
          <button className="acct-btn" onClick={() => setShowAdd(true)}>
            + {d.addChild}
          </button>
        )}
      </div>
    );
  }

  // ——— Logged out: phone → OTP ———
  return (
    <div className="acct-box">
      {error && <div className="acct-err" role="alert">{errMsg(error)}</div>}

      {step === 'phone' ? (
        <>
          <div className="acct-field">
            <label htmlFor="acct-phone">{d.phoneLabel}</label>
            <input
              id="acct-phone"
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              placeholder={d.phonePlaceholder}
              value={phone}
              onChange={(e) => setPhone(toAscii(e.target.value))}
              onKeyDown={(e) => e.key === 'Enter' && phone && sendCode()}
            />
          </div>
          <button className="acct-btn" onClick={sendCode} disabled={busy || !phone.trim()}>
            {busy ? d.sending : d.sendCode}
          </button>
        </>
      ) : (
        <>
          <div className="acct-note">
            {d.codeSentTo} <bdo dir="ltr">{phone}</bdo>
            {devCode && (
              <>
                {' — '}
                {d.devCodeNote} <span className="acct-devcode">{devCode}</span>
              </>
            )}
          </div>
          {isNew && (
            <>
              <div className="acct-note">{d.newFamilyNote}</div>
              <div className="acct-field">
                <label htmlFor="acct-parent">{d.parentNameLabel}</label>
                <input
                  id="acct-parent"
                  placeholder={d.parentNamePlaceholder}
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  maxLength={80}
                />
              </div>
            </>
          )}
          <div className="acct-field">
            <label htmlFor="acct-code">{d.codeLabel}</label>
            <input
              id="acct-code"
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(toAscii(e.target.value).replace(/\D/g, '').slice(0, 6))}
              onKeyDown={(e) => e.key === 'Enter' && code.length === 6 && verify()}
            />
          </div>
          <button className="acct-btn" onClick={verify} disabled={busy || code.length !== 6 || (isNew && !parentName.trim())}>
            {busy ? d.verifying : d.verify}
          </button>
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <button
              className="acct-btn ghost"
              onClick={() => {
                setStep('phone');
                setCode('');
                setDevCode(null);
                setError(null);
              }}
            >
              {d.changePhone}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
