'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLearningLocale } from '@/components/learning/locale';
import { classifyHome, LearnerRecovery, type HomeFailure } from '@/components/learning/LearnerRecovery';

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
  const [failure, setFailure] = useState<HomeFailure | null>(null);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    params.then((p) => setChildId(p.childId));
  }, [params]);

  useEffect(() => {
    if (!childId) return;
    let cancelled = false;
    setHomeError('');
    setFailure(null);
    setChild(null);
    fetch('/svc/learn/home', { cache: 'no-store' })
      .then(async (r) => {
        const kind = await classifyHome(r.clone());
        if (cancelled) return;
        if (kind) {
          setFailure(kind);
          // Session expiry returns the device to the right gate; the panel stays as a fallback.
          if (kind === 'signin') router.replace(path('/account?next=') + path('/learn'));
          if (kind === 'chooser') router.replace(path('/learn?reason=session'));
          return;
        }
        const data = await r.json();
        // The URL is part of the selected-child boundary. Never place a
        // session-selected child's shell around another child's route.
        if (String(data?.child?.id) !== childId) {
          setFailure('chooser');
          router.replace(path('/learn?reason=profile'));
          return;
        }
        if (!cancelled) setChild(data.child);
      })
      .catch(() => {
        if (!cancelled) setFailure('transient');
      });
    return () => { cancelled = true; };
  }, [childId, router, attempts]);

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
        <Link className="kid-search-btn" href={path(`/learn/${childId}/search`)} aria-label={t('البحث عن درس', 'Search lessons')} data-testid="link-learner-search">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        </Link>
        <div style={{ flex: 1 }}>
          {child && (
            <>
              <div className="kid-topbar-name" data-testid="text-learner-name">{child.avatar} {child.name}</div>
              <div className="kid-topbar-xp" data-testid="text-learner-xp">{child.xp} XP</div>
            </>
          )}
        </div>
        {child && <div className="kid-topbar-streak" data-testid="text-learner-streak" aria-label={t(`سلسلة ${child.streak} أيام`, `${child.streak}-day streak`)}>{child.streak} {t('يوم', 'days')}</div>}
        <button
          className="kid-search-btn"
          onClick={() => setParentGate(true)}
          title={t('وضع الأهل', 'Parent mode')}
          aria-label={t('وضع الأهل', 'Parent mode')}
          data-testid="button-learner-parent"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
        </button>
      </div>
      {homeError && (
        <div className="kid-content" role="alert" style={{ padding: '12px 20px', textAlign: 'center', color: '#c0392b' }}>
          {homeError}{' '}
          <button className="btn" type="button" onClick={() => setHomeError('')}>{t('حسناً', 'OK')}</button>
        </div>
      )}

      {/* Parent gate */}
      {parentGate && (
        <ParentGate
          onConfirm={exitKidMode}
          onCancel={() => setParentGate(false)}
        />
      )}

      {failure && !child && <div className="kid-content"><LearnerRecovery kind={failure} attempts={attempts + 1} onRetry={() => setAttempts((a) => a + 1)} /></div>}
      {child ? children : !homeError && !failure && (
        <div className="kid-content" role="status" aria-busy="true" data-testid="status-learner-loading">
          <span className="kid-sr">{t('جاري التحميل...', 'Loading...')}</span>
          <div className="kid-skel" style={{ height: 120 }} />
          <div className="kid-skel" style={{ height: 90, marginTop: 14 }} />
        </div>
      )}
    </div>
  );
}

function ParentGate({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  const { t, dir } = useLearningLocale();
  useEffect(() => () => {
    document.querySelector<HTMLButtonElement>('[data-testid="button-learner-parent"]')?.focus();
  }, []);
  return (
    <div className="kid-parent-gate">
      <div className="kid-parent-gate-box" dir={dir} role="dialog" aria-modal="true" aria-labelledby="kid-gate-title" data-testid="dialog-parent-gate"
        onKeyDown={event => {
          if (event.key === 'Escape') { event.preventDefault(); onCancel(); }
          if (event.key === 'Tab') {
            const buttons = event.currentTarget.querySelectorAll<HTMLButtonElement>('button');
            const first = buttons[0], last = buttons[buttons.length - 1];
            if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
            else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
          }
        }}>
        <div className="kid-parent-gate-icon" aria-hidden="true" />
        <div className="kid-parent-gate-title" id="kid-gate-title">{t('هل تريد الخروج من وضع الطفل؟', 'Exit child mode?')}</div>
        <p style={{ color: '#555', fontSize: 14, margin: 0 }}>
          {t('سيعود الجهاز إلى اختيار الطفل.', 'You will return to learner selection.')}
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
          <button className="btn y" onClick={onConfirm} data-testid="button-parent-gate-confirm">{t('نعم، اخرج', 'Yes, exit')}</button>
          <button className="btn" onClick={onCancel} autoFocus data-testid="button-parent-gate-cancel">{t('إلغاء', 'Cancel')}</button>
        </div>
      </div>
    </div>
  );
}
