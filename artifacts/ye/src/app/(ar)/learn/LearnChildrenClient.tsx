'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { LrnChild } from '@prisma/client';
import { useLearningLocale } from '@/components/learning/locale';

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
  const { t, dir } = useLearningLocale();
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
      setErr(t('أدخل اسم الطفل ورقم PIN (4 أرقام على الأقل)', 'Enter the child’s name and a PIN of at least 4 digits'));
      return;
    }
    if (form.nationalId.trim() && !NATIONAL_ID_RE.test(form.nationalId.trim())) {
      setErr(t('رقم الهوية: ١٠ أرقام ويبدأ بـ 1 أو 2 (أو اتركه فارغاً)', 'National ID must contain 10 digits starting with 1 or 2, or be left blank'));
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
            ? t('PIN يجب أن يكون 4 أرقام على الأقل', 'PIN must contain at least 4 digits')
            : j.error === 'invalid_national_id'
              ? t('رقم الهوية: ١٠ أرقام ويبدأ بـ 1 أو 2', 'National ID must contain 10 digits starting with 1 or 2')
              : j.error === 'national_id_taken'
                ? t('رقم الهوية هذا مسجّل لطفل آخر', 'This national ID belongs to another child')
                : t('حدث خطأ', 'Something went wrong. Please try again.'),
        );
        return;
      }
      const child = await res.json();
      setChildren((prev) => [...prev, child]);
      setShowAdd(false);
      setForm({ name: '', avatar: '⭐', band: 'explorers', pin: '', nationalId: '' });
    } catch {
      setErr(t('حدث خطأ في الاتصال', 'Connection failed. Please try again.'));
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
          <span>{t('إضافة طفل', 'Add a child')}</span>
        </button>
      </div>

      {showAdd && (
        <div className="learn-modal-backdrop" onClick={() => setShowAdd(false)}>
          <div className="learn-modal" onClick={(e) => e.stopPropagation()} dir={dir}>
            <h2 className="learn-modal-title">{t('إضافة ملف طفل', 'Add a child profile')}</h2>

            <label className="learn-label" htmlFor="child-name">{t('اسم الطفل', 'Child’s name')}</label>
            <input
              id="child-name"
              className="learn-input"
              placeholder={t('مثال: محمد', 'Example: Mohammed')}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />

            <label className="learn-label">{t('الصورة الرمزية', 'Avatar')}</label>
            <div className="learn-avatar-grid">
              {AVATARS.map((a) => (
                <button
                  key={a}
                  aria-label={`${t('الصورة الرمزية', 'Avatar')} ${a}`}
                  aria-pressed={form.avatar === a}
                  className={`learn-avatar-btn${form.avatar === a ? ' selected' : ''}`}
                  onClick={() => setForm((f) => ({ ...f, avatar: a }))}
                >
                  {a}
                </button>
              ))}
            </div>

            <label className="learn-label" htmlFor="child-band">{t('المستوى', 'Level')}</label>
            <select
              id="child-band"
              className="learn-input"
              value={form.band}
              onChange={(e) => setForm((f) => ({ ...f, band: e.target.value }))}
            >
              {BANDS.map((b) => (
                <option key={b} value={b}>{t(BAND_LABELS_AR[b], b[0].toUpperCase() + b.slice(1))}</option>
              ))}
            </select>

            <label className="learn-label" htmlFor="child-pin">{t('رمز PIN (للدخول إلى وضع الطفل)', 'PIN (to enter child mode)')}</label>
            <input
              id="child-pin"
              className="learn-input"
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder={t('4 أرقام على الأقل', 'At least 4 digits')}
              value={form.pin}
              onChange={(e) => setForm((f) => ({ ...f, pin: e.target.value.replace(/\D/g, '') }))}
            />

            <label className="learn-label" htmlFor="child-national-id">
              {t('رقم هوية الطفل (اختياري — لتوثيق تعلّمه في المنصة الوطنية نيلك)', 'Child’s national ID (optional — to record learning with NELC)')}
            </label>
            <input
              id="child-national-id"
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
                {adding ? t('جاري الإنشاء...', 'Creating...') : t('إنشاء', 'Create')}
              </button>
              <button className="btn" onClick={() => setShowAdd(false)}>{t('إلغاء', 'Cancel')}</button>
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
  const { t, path } = useLearningLocale();
  const [pin, setPin] = useState('');
  const [entering, setEntering] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  async function enterKidMode() {
    if (!/^\d{4,}$/.test(pin)) { setErr(t('أدخل رمز PIN رقمي (4 أرقام على الأقل)', 'Enter a PIN of at least 4 digits')); return; }
    setLoading(true);
    setErr('');
    try {
      const res = await fetch(`/svc/learn/children/${child.id}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });
      if (!res.ok) {
        setErr(res.status === 401 ? t('رمز PIN غير صحيح', 'Incorrect PIN') : t('حدث خطأ', 'Something went wrong. Please try again.'));
        setPin('');
        return;
      }
      window.location.href = path(`/learn/${child.id}`);
    } catch {
      setErr(t('حدث خطأ في الاتصال', 'Connection failed. Please try again.'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="learn-child-card">
      <div className="learn-child-avatar">{child.avatar}</div>
      <div className="learn-child-name">{child.name}</div>
      <div className="learn-child-band">{t(BAND_LABELS_AR[child.band], child.band[0].toUpperCase() + child.band.slice(1))}</div>
      <div className="learn-child-xp">⭐ {child.xp} XP &nbsp;|&nbsp; 🔥 {child.streak}</div>
      {child.badges.length > 0 && (
        <div className="learn-child-badges">
          {child.badges.slice(0, 3).map((b) => (
            <span key={b} title={t(({ first_lesson: 'الدرس الأول', five_lessons: 'خمسة دروس', ten_lessons: 'عشرة دروس', streak_3: 'ثلاثة أيام متتالية', streak_7: 'سبعة أيام متتالية', perfect_score: 'نتيجة كاملة' } as Record<string, string>)[b] ?? 'شارة', b.replaceAll('_', ' '))}>{badgeIcons[b] ?? '🏅'}</span>
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
            placeholder={t('رمز PIN', 'PIN')}
            aria-label={t('رمز PIN', 'PIN')}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => { if (e.key === 'Enter') enterKidMode(); }}
            autoFocus
          />
          {err && <p className="learn-err">{err}</p>}
          <div className="learn-pin-actions">
            <button className="btn y small" onClick={enterKidMode} disabled={loading}>
              {loading ? t('جاري الدخول...', 'Signing in...') : t('دخول', 'Enter')}
            </button>
            <button className="btn small" onClick={() => { setEntering(false); setPin(''); setErr(''); }}>{t('إلغاء', 'Cancel')}</button>
          </div>
        </div>
      ) : (
        <button className="btn y learn-enter-btn" onClick={() => setEntering(true)}>
          {t('ابدأ التعلّم 🚀', 'Start learning 🚀')}
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
  const { t } = useLearningLocale();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  async function save() {
    const v = value.trim();
    if (!NATIONAL_ID_RE.test(v)) {
      setErr(t('رقم الهوية: ١٠ أرقام ويبدأ بـ 1 أو 2', 'National ID must contain 10 digits starting with 1 or 2'));
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
            ? t('هذا الرقم مسجّل لطفل آخر', 'This national ID belongs to another child')
            : j.error === 'national_id_locked'
              ? t('لا يمكن تغيير الرقم بعد بدء إرسال بيانات التعلّم لنيلك', 'The ID cannot be changed after learning records have been sent to NELC')
              : j.error === 'invalid_national_id'
                ? t('رقم الهوية غير صحيح', 'Invalid national ID')
                : t('حدث خطأ', 'Something went wrong. Please try again.'),
        );
        return;
      }
      onUpdate(j);
      setEditing(false);
    } catch {
      setErr(t('حدث خطأ في الاتصال', 'Connection failed. Please try again.'));
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="learn-child-nid">
        <button
          className="learn-nid-btn"
          title={t('رقم هوية الطفل لتوثيق تعلّمه في المنصة الوطنية نيلك', 'Child’s national ID for NELC learning records')}
          onClick={() => {
            setValue(child.nationalId ?? '');
            setErr('');
            setEditing(true);
          }}
        >
          {child.nationalId ? (
            <>🪪 <span className="nid-value">{child.nationalId}</span></>
          ) : (
            <>🪪 {t('إضافة رقم الهوية (لتوثيق التعلّم في نيلك)', 'Add national ID (for NELC learning records)')}</>
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
        aria-label={t('رقم الهوية', 'National ID')}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') save(); }}
        autoFocus
      />
      {err && <p className="learn-err">{err}</p>}
      <div className="learn-nid-actions">
        <button className="btn y small" onClick={save} disabled={saving}>
          {saving ? t('جاري الحفظ...', 'Saving...') : t('حفظ', 'Save')}
        </button>
        <button className="btn small" onClick={() => { setEditing(false); setErr(''); }}>
          {t('إلغاء', 'Cancel')}
        </button>
      </div>
    </div>
  );
}
