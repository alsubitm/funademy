'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLearningLocale } from '@/components/learning/locale';

interface KidData {
  id: number;
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  band: string;
}

export default function KidLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ childId: string }>;
}) {
  const router = useRouter();
  const { t, path, dir, lang } = useLearningLocale();
  const [child, setChild] = useState<KidData | null>(null);
  const [parentGate, setParentGate] = useState(false);
  const [childId, setChildId] = useState<string>('');
  const [homeError, setHomeError] = useState('');

  useEffect(() => {
    params.then((p) => setChildId(p.childId));
  }, [params]);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    setHomeError('');
    setChild(null);
    fetch('/svc/learn/home')
      .then(async (r) => {
        if (r.status === 401 || r.status === 404) {
          router.replace(path('/learn'));
          return;
        }
        if (!r.ok) throw new Error(`home request failed (${r.status})`);
        const data = await r.json();
        // The URL is part of the selected-child boundary. Never place a
        // session-selected child's shell around another child's route.
        if (String(data?.child?.id) !== childId) {
          router.replace(path('/learn'));
          return;
        }
        if (!cancelled) setChild(data.child);
      })
      .catch(() => {
        if (!cancelled) setHomeError(t('تعذر تحميل بيانات الطفل. أعد المحاولة.', 'Could not load the child’s profile. Please try again.'));
      });
    return () => { cancelled = true; };
  }, [childId, router]);

  useEffect(() => {
    function updateProgress(event: Event) {
      const detail = (event as CustomEvent<{
        childId?: number;
        totalXp?: number;
        streak?: number;
      }>).detail;
      if (!detail || String(detail.childId) !== childId) return;
      setChild((current) => current ? {
        ...current,
        xp: typeof detail.totalXp === 'number' ? detail.totalXp : current.xp,
        streak: typeof detail.streak === 'number' ? detail.streak : current.streak,
      } : current);
    }
    window.addEventListener('funademy:child-progress', updateProgress);
    return () => window.removeEventListener('funademy:child-progress', updateProgress);
  }, [childId]);

  async function exitKidMode() {
    try {
      const response = await fetch('/svc/learn/children/deselect', { method: 'POST' });
      if (!response.ok) throw new Error('deselect_failed');
      router.push(path('/learn'));
    } catch {
      setHomeError(t('تعذر الخروج. حاول مرة أخرى.', 'Could not exit child mode. Please try again.'));
      setParentGate(false);
    }
  }

  return (
    <div className="kid-shell" dir={dir} lang={lang}>
      {/* Top bar */}
      <div className="kid-topbar">
        <Link className="kid-search-btn" href={path(`/learn/${childId}/search`)} aria-label={t('البحث عن درس', 'Search lessons')}>🔍</Link>
        <div style={{ flex: 1 }}>
          {child && (
            <>
              <div className="kid-topbar-name">{child.avatar} {child.name}</div>
              <div className="kid-topbar-xp">⭐ {child.xp} XP</div>
            </>
          )}
        </div>
        {child && <div className="kid-topbar-streak">🔥 {child.streak}</div>}
        <button
          className="kid-search-btn"
          onClick={() => setParentGate(true)}
          title={t('وضع الأهل', 'Parent mode')}
          aria-label={t('وضع الأهل', 'Parent mode')}
          style={{ fontSize: 20 }}
        >
          🛡️
        </button>
      </div>
      {homeError && (
        <div className="kid-content" role="alert" style={{ padding: '12px 20px', textAlign: 'center', color: '#c0392b' }}>
          {homeError}{' '}
          <button className="btn" type="button" onClick={() => window.location.reload()}>{t('إعادة المحاولة', 'Try again')}</button>
        </div>
      )}

      {/* Parent gate */}
      {parentGate && (
        <ParentGate
          onConfirm={exitKidMode}
          onCancel={() => setParentGate(false)}
        />
      )}

      {child ? children : !homeError && <div role="status">{t('جاري التحميل...', 'Loading...')}</div>}
    </div>
  );
}

function ParentGate({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t, dir } = useLearningLocale();
  return (
    <div className="kid-parent-gate">
      <div className="kid-parent-gate-box" dir={dir}>
        <div className="kid-parent-gate-icon">🛡️</div>
        <div className="kid-parent-gate-title">{t('هل تريد الخروج من وضع الطفل؟', 'Exit child mode?')}</div>
        <p style={{ color: '#555', fontSize: 14, margin: 0 }}>
          {t('سيعود الجهاز إلى اختيار الطفل.', 'You will return to learner selection.')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
          <button className="btn y" onClick={onConfirm}>{t('نعم، اخرج', 'Yes, exit')}</button>
          <button className="btn" onClick={onCancel}>{t('إلغاء', 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
}
