'use client';

import { useState } from 'react';
import type { Lang } from './types';
import { t } from './strings';

export function PasswordChange({ lang, onSignedOut, beforeSubmit }: {
  lang: Lang; onSignedOut: (changed: boolean) => void; beforeSubmit: () => boolean;
}) {
  const s = t(lang);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ar = lang === 'ar';
  const rules = ar ? 'استخدم 12–128 حرفاً وكلمة مرور مختلفة عن الحالية. بعد التغيير ستُنهى جميع جلساتك ويجب تسجيل الدخول مجدداً.' : 'Use 12–128 characters and a different password. Changing it signs you out on all devices; sign in again afterward.';
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (next !== confirm) { setError(ar ? 'كلمتا المرور غير متطابقتين.' : 'The new passwords do not match.'); return; }
    if (next.trim().length < 12 || next.length > 128 || next === current) { setError(rules); return; }
    if (!beforeSubmit()) return;
    setBusy(true);
    try {
      const res = await fetch('/svc/instructor/password', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: current, newPassword: next }),
      });
      if (res.ok || res.status === 401) { onSignedOut(res.ok); return; }
      const body = await res.json().catch(() => ({}));
      setError(res.status === 429 ? s.errRate : body.error === 'incorrect_password'
        ? (ar ? 'كلمة المرور الحالية غير صحيحة.' : 'The current password is incorrect.')
        : body.error === 'invalid_password' ? rules : res.status === 503 ? s.errUnavailable : s.errGeneric);
    } catch { setError(s.errGeneric); }
    finally { setCurrent(''); setNext(''); setConfirm(''); setBusy(false); }
  };
  return <form className="ip-card" style={{ maxWidth: 640, marginTop: 20 }} onSubmit={submit} data-testid="form-instructor-password">
    <h3>{ar ? 'تغيير كلمة المرور' : 'Change password'}</h3>
    <p id="ip-password-rules" className="ip-lead">{rules}</p>
    <fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0 }}>
      {[
        { id: 'current', label: ar ? 'كلمة المرور الحالية' : 'Current password', value: current, set: setCurrent },
        { id: 'new', label: ar ? 'كلمة المرور الجديدة' : 'New password', value: next, set: setNext },
        { id: 'confirm', label: ar ? 'تأكيد كلمة المرور الجديدة' : 'Confirm new password', value: confirm, set: setConfirm },
      ].map(f => <div key={f.id} style={{ marginBottom: 14 }}>
        <label htmlFor={`ip-password-${f.id}`}>{f.label}</label>
        <input id={`ip-password-${f.id}`} className="ip-input" type="password" dir="ltr" required
          autoComplete={f.id === 'current' ? 'current-password' : 'new-password'}
          minLength={f.id === 'current' ? 1 : 12} maxLength={128} aria-describedby="ip-password-rules"
          value={f.value} onChange={e => f.set(e.target.value)} />
      </div>)}
      {error && <p className="ip-error" role="alert">{error}</p>}
      <button className="ip-btn" type="submit">{busy ? s.saving : ar ? 'تغيير كلمة المرور وتسجيل الخروج' : 'Change password and sign out'}</button>
    </fieldset>
  </form>;
}
