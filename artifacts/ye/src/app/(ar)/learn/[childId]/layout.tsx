'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface KidData {
  id: number;
  name: string;
  avatar: string;
  xp: number;
  streak: number;
  band: string;
}

interface SearchResult {
  id: number;
  titleAr: string;
  subjectNameAr: string;
  subjectIcon: string;
  subjectColor: string;
  durationMinutes: number;
  completed: boolean;
}

export default function KidLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ childId: string }>;
}) {
  const router = useRouter();
  const [child, setChild] = useState<KidData | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [parentGate, setParentGate] = useState(false);
  const [childId, setChildId] = useState<string>('');
  const [homeError, setHomeError] = useState('');
  const [searchError, setSearchError] = useState('');

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
          router.replace('/learn');
          return;
        }
        if (!r.ok) throw new Error(`home request failed (${r.status})`);
        const data = await r.json();
        // The URL is part of the selected-child boundary. Never place a
        // session-selected child's shell around another child's route.
        if (String(data?.child?.id) !== childId) {
          router.replace('/learn');
          return;
        }
        if (!cancelled) setChild(data.child);
      })
      .catch(() => {
        if (!cancelled) setHomeError('تعذر تحميل بيانات الطفل. أعد المحاولة.');
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

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); setSearchError(''); return; }
    try {
      const response = await fetch(`/svc/learn/search?q=${encodeURIComponent(q)}`);
      if (!response.ok) throw new Error(`search request failed (${response.status})`);
      setResults(await response.json());
      setSearchError('');
    } catch {
      setResults([]);
      setSearchError('تعذر البحث الآن. حاول مرة أخرى.');
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(t);
  }, [query, doSearch]);

  async function exitKidMode() {
    await fetch('/svc/learn/children/deselect', { method: 'POST' });
    router.push('/learn');
  }

  return (
    <div className="kid-shell" dir="rtl" lang="ar">
      {/* Top bar */}
      <div className="kid-topbar">
        <button className="kid-search-btn" onClick={() => setSearchOpen(true)}>🔍</button>
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
          title="وضع الأهل"
          style={{ fontSize: 20 }}
        >
          🛡️
        </button>
      </div>
      {homeError && (
        <div className="kid-content" role="alert" style={{ padding: '12px 20px', textAlign: 'center', color: '#c0392b' }}>
          {homeError}{' '}
          <button className="btn" type="button" onClick={() => window.location.reload()}>إعادة المحاولة</button>
        </div>
      )}

      {/* Search overlay */}
      {searchOpen && (
        <div className="kid-search-overlay" onClick={() => setSearchOpen(false)}>
          <div className="kid-search-inner" onClick={(e) => e.stopPropagation()}>
            <input
              className="kid-search-input"
              placeholder="ابحث عن درس..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className="kid-search-results">
                {searchError && (
                  <div style={{ padding: '20px 16px', color: '#c0392b', textAlign: 'center' }}>
                    {searchError}{' '}
                    <button type="button" className="btn" onClick={() => doSearch(query)}>إعادة المحاولة</button>
                  </div>
                )}
              {results.map((r) => (
                <Link
                  key={r.id}
                  className="kid-search-result"
                  href={`/learn/${childId}/lessons/${r.id}`}
                  onClick={() => setSearchOpen(false)}
                >
                  <span className="kid-search-icon" style={{ color: r.subjectColor }}>{r.subjectIcon}</span>
                  <div className="kid-search-info">
                    <div className="kid-search-title">{r.titleAr}</div>
                    <div className="kid-search-sub">{r.subjectNameAr} · {r.durationMinutes} دقيقة</div>
                  </div>
                  {r.completed && <span className="kid-search-check">✓</span>}
                </Link>
              ))}
              {query && results.length === 0 && (
                <div style={{ padding: '20px 16px', color: '#888', textAlign: 'center' }}>لا توجد نتائج</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Parent gate */}
      {parentGate && (
        <ParentGate
          onConfirm={exitKidMode}
          onCancel={() => setParentGate(false)}
        />
      )}

      {children}
    </div>
  );
}

function ParentGate({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="kid-parent-gate">
      <div className="kid-parent-gate-box" dir="rtl">
        <div className="kid-parent-gate-icon">🛡️</div>
        <div className="kid-parent-gate-title">هل تريد الخروج من وضع الطفل؟</div>
        <p style={{ color: '#555', fontSize: 14, margin: 0 }}>
          سيعود الجهاز إلى بوابة الأهالي.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 8 }}>
          <button className="btn y" onClick={onConfirm}>نعم، اخرج</button>
          <button className="btn" onClick={onCancel}>إلغاء</button>
        </div>
      </div>
    </div>
  );
}
