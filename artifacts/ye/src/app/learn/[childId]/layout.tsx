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

  useEffect(() => {
    params.then((p) => setChildId(p.childId));
  }, [params]);

  useEffect(() => {
    if (!childId) return;
    fetch('/svc/learn/home')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d?.child) setChild(d.child); })
      .catch(() => {});
  }, [childId]);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    const r = await fetch(`/svc/learn/search?q=${encodeURIComponent(q)}`).then((x) => x.ok ? x.json() : []).catch(() => []);
    setResults(r);
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
