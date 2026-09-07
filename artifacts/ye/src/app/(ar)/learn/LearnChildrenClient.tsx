'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LrnChild } from '@prisma/client';

/** Saudi national ID / iqama: 10 digits starting with 1 or 2 (mirrors the server rule). */
const NATIONAL_ID_RE = /^[12]\d{9}$/;

type ChildData = Omit<LrnChild, 'pin'>;

interface Props {
  familyId: number;
  initialChildren: ChildData[];
  bandLabels: Record<string, string>;
  badgeIcons: Record<string, string>;
}

const AVATARS = ['⭐', '🦁', '🐉', '🚀', '🤖', '🌟', '🦊', '🐧', '🦄', '🏆'];
const BANDS = ['explorers', 'builders', 'achievers', 'graduates'] as const;
const BAND_LABELS_AR: Record<string, string> = {
  explorers: 'المستكشفون',
  builders: 'الصانعون',
  achievers: 'المتفوقون',
  graduates: 'الخريجون',
};

export default function LearnChildrenClient({ initialChildren, badgeIcons }: Props) {
  const [children, setChildren] = useState<ChildData[]>(initialChildren);
  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    name: '',
    avatar: '⭐',
    band: 'explorers',
    pin: '',
    nationalId: '',
  });
  const [err, setErr] = useState('');

  async function createChild() {
    if (!form.name.trim() || !/^\d{4,}$/.test(form.pin)) {
      setErr('أدخل اسم الطفل ورقم PIN (4 أرقام على الأقل)');
      return;
    }
    if (form.nationalId.trim() && !NATIONAL_ID_RE.test(form.nationalId.trim())) {
      setErr('رقم الهوية: ١٠ أرقام ويبدأ بـ 1 أو 2 (أو اتركه فارغاً)');
      return;
    }
    setAdding(true);
    setErr('');
    try {
      const res = await fetch('/svc/learn/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, nationalId: form.nationalId.trim() }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(
          j.error === 'invalid_pin'
            ? 'PIN يجب أن يكون 4 أرقام على الأقل'
            : j.error === 'invalid_national_id'
              ? 'رقم الهوية: ١٠ أرقام ويبدأ بـ 1 أو 2'
              : j.error === 'national_id_taken'
                ? 'رقم الهوية هذا مسجّل لطفل آخر'
                : 'حدث خطأ',
        );
        return;
      }
      const child = await res.json();
      setChildren((prev) => [...prev, child]);
      setShowAdd(false);
      setForm({ name: '', avatar: '⭐', band: 'explorers', pin: '', nationalId: '' });
    } catch {
      setErr('حدث خطأ في الاتصال');
    } finally {
      setAdding(false);
    }
  }

  return (
    <div className="learn-children-wrap">
      <div className="learn-children-grid">
        {children.map((c) => (
          <ChildCard
            key={c.id}
            child={c}
            badgeIcons={badgeIcons}
            onUpdate={(u) => setChildren((prev) => prev.map((x) => (x.id === u.id ? u : x)))}
          />
        ))}
        <button className="learn-add-card" onClick={() => setShowAdd(true)}>
          <span className="learn-add-icon">+</span>
          <span>إضافة طفل</span>
        </button>
      </div>

      {showAdd && (
        <div className="learn-modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="learn-modal" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h2 className="learn-modal-title">إضافة ملف طفل</h2>

            <label className="learn-label">اسم الطفل</label>
            <input
              className="learn-input"
              placeholder="مثال: محمد"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />

            <label className="learn-label">الصورة الرمزية</label>
            <div className="learn-avatar-grid">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  className={`learn-avatar-btn${form.avatar === a ? ' selected' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, avatar: a }))}
                >
                  {a}
                </button>
              ))}
            </div>

            <label className="learn-label">المستوى</label>
            <select
              className="learn-input"
              value={form.band}
              onChange={(e) => setForm((f) => ({ ...f, band: e.target.value }))}
            >
              {BANDS.map((b) => (
                <option key={b} value={b}>{BAND_LABELS_AR[b]}</option>
              ))}
            </select>

            <label className="learn-label">رمز PIN (للدخول إلى وضع الطفل)</label>
            <input
              className="learn-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="4 أرقام على الأقل"
              value={form.pin}
              onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
            />

            <label className="learn-label">
              رقم هوية الطفل (اختياري — لتوثيق تعلّمه في المنصة الوطنية نيلك)
            </label>
            <input
              className="learn-input"
              dir="ltr"
              inputMode="numeric"
              maxLength={10}
              placeholder="1xxxxxxxxx"
              value={form.nationalId}
              onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))}
            />

            {err && <p className="learn-err">{err}</p>}

            <div className="learn-modal-actions">
              <button className="btn y" onClick={createChild} disabled={adding}>
                {adding ? '...' : 'إنشاء'}
              </button>
              <button className="btn" onClick={() => setShowAdd(false)}>إلغاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ChildCard({
  child,
  badgeIcons,
  onUpdate,
}: {
  child: ChildData;
  badgeIcons: Record<string, string>;
  onUpdate: (c: ChildData) => void;
}) {
  const [pin, setPin] = useState('');
  const [entering, setEntering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function enterKidMode() {
    if (!/^\d{4,}$/.test(pin)) { setErr('أدخل رمز PIN رقمي (4 أرقام على الأقل)'); return; }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/svc/learn/children/${child.id}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setErr(res.status === 401 ? 'رمز PIN غير صحيح' : 'حدث خطأ');
        setPin('');
        return;
      }
      window.location.href = `/learn/${child.id}`;
    } catch {
      setErr('حدث خطأ في الاتصال');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="learn-child-card">
      <div className="learn-child-avatar">{child.avatar}</div>
      <div className="learn-child-name">{child.name}</div>
      <div className="learn-child-band">{BAND_LABELS_AR[child.band]}</div>
      <div className="learn-child-xp">⭐ {child.xp} XP &nbsp;|&nbsp; 🔥 {child.streak}</div>
      {child.badges.length > 0 && (
        <div className="learn-child-badges">
          {child.badges.slice(0, 3).map((b) => (
            <span key={b} title={b}>{badgeIcons[b] ?? '🏅'}</span>
          ))}
        </div>
      )}

      <NationalIdRow child={child} onUpdate={onUpdate} />

      {entering ? (
        <div className="learn-pin-wrap">
          <input
            className="learn-input learn-pin-input"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="رمز PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') enterKidMode(); }}
            autoFocus
          />
          {err && <p className="learn-err">{err}</p>}
          <div className="learn-pin-actions">
            <button className="btn y small" onClick={enterKidMode} disabled={loading}>
              {loading ? '...' : 'دخول'}
            </button>
            <button className="btn small" onClick={() => { setEntering(false); setPin(''); setErr(''); }}>إلغاء</button>
          </div>
        </div>
      ) : (
        <button className="btn y learn-enter-btn" onClick={() => setEntering(true)}>
          ابدأ التعلّم 🚀
        </button>
      )}
    </div>
  );
}

/**
 * Child national ID — the learner identity used to report REAL progress to
 * the national learning platform (NELC). Optional; editable until the first
 * statements are queued for NELC (then the server locks it).
 */
function NationalIdRow({ child, onUpdate }: { child: ChildData; onUpdate: (c: ChildData) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    const v = value.trim();
    if (!NATIONAL_ID_RE.test(v)) {
      setErr('رقم الهوية: ١٠ أرقام ويبدأ بـ 1 أو 2');
      return;
    }
    setSaving(true);
    setErr('');
    try {
      const res = await fetch(`/svc/learn/children/${child.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nationalId: v }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(
          j.error === 'national_id_taken'
            ? 'هذا الرقم مسجّل لطفل آخر'
            : j.error === 'national_id_locked'
              ? 'لا يمكن تغيير الرقم بعد بدء إرسال بيانات التعلّم لنيلك'
              : j.error === 'invalid_national_id'
                ? 'رقم الهوية غير صحيح'
                : 'حدث خطأ',
        );
        return;
      }
      onUpdate(j);
      setEditing(false);
    } catch {
      setErr('حدث خطأ في الاتصال');
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="learn-child-nid">
        <button
          className="learn-nid-btn"
          title="رقم هوية الطفل لتوثيق تعلّمه في المنصة الوطنية نيلك"
          onClick={() => {
            setValue(child.nationalId ?? '');
            setErr('');
            setEditing(true);
          }}
        >
          {child.nationalId ? (
            <>🪪 <span className="nid-value">{child.nationalId}</span></>
          ) : (
            <>🪪 إضافة رقم الهوية (لتوثيق التعلّم في نيلك)</>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="learn-child-nid learn-nid-edit">
      <input
        className="learn-input learn-pin-input"
        dir="ltr"
        inputMode="numeric"
        maxLength={10}
        placeholder="1xxxxxxxxx"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        autoFocus
      />
      {err && <p className="learn-err">{err}</p>}
      <div className="learn-nid-actions">
        <button className="btn y small" onClick={save} disabled={saving}>
          {saving ? '...' : 'حفظ'}
        </button>
        <button className="btn small" onClick={() => { setEditing(false); setErr(''); }}>
          إلغاء
        </button>
      </div>
    </div>
  );
}
