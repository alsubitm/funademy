'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LrnChild } from '@prisma/client';

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
  });
  const [err, setErr] = useState('');

  async function createChild() {
    if (!form.name.trim() || form.pin.length < 4) {
      setErr('أدخل اسم الطفل ورقم PIN (4 أرقام على الأقل)');
      return;
    }
    setAdding(true);
    setErr('');
    try {
      const res = await fetch('/svc/learn/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setErr(j.error === 'pin_too_short' ? 'PIN يجب أن يكون 4 أرقام على الأقل' : 'حدث خطأ');
        return;
      }
      const child = await res.json();
      setChildren((prev) => [...prev, child]);
      setShowAdd(false);
      setForm({ name: '', avatar: '⭐', band: 'explorers', pin: '' });
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
          <ChildCard key={c.id} child={c} badgeIcons={badgeIcons} />
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
              placeholder="4 أرقام على الأقل"
              value={form.pin}
              onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value }))}
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

function ChildCard({ child, badgeIcons }: { child: ChildData; badgeIcons: Record<string, string> }) {
  const [pin, setPin] = useState('');
  const [entering, setEntering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function enterKidMode() {
    if (!pin) { setErr('أدخل رمز PIN'); return; }
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

      {entering ? (
        <div className="learn-pin-wrap">
          <input
            className="learn-input learn-pin-input"
            type="password"
            inputMode="numeric"
            placeholder="رمز PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
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
