'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useLearningLocale } from '@/components/learning/locale';

interface Result {
  id: number;
  titleAr: string;
  titleEn: string;
  subjectNameAr: string;
  subjectNameEn: string;
  subjectIcon: string;
  durationMinutes: number;
  completed: boolean;
}

export default function LearningSearchPage() {
  const { childId } = useParams<{ childId: string }>();
  const search = useSearchParams();
  const { t, path, content } = useLearningLocale();
  const childSelectionPath = path('/learn');
  const [query, setQuery] = useState(search.get('q') ?? '');
  const [results, setResults] = useState<Result[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setResults([]);
    if (!query.trim()) { setStatus('idle'); return; }
    setStatus('loading');
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/svc/learn/search?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (response.status === 401) {
          setResults([]);
          window.location.href = childSelectionPath;
          return;
        }
        if (!response.ok) throw new Error('search_failed');
        const data = await response.json();
        if (!controller.signal.aborted) { setResults(data); setStatus('idle'); }
      } catch {
        if (!controller.signal.aborted) setStatus('error');
      }
    }, 300);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, retry, childSelectionPath]);

  return <div className="kid-content">
    <Link href={path(`/learn/${childId}`)}>{t('← الرئيسية', '← Home')}</Link>
    <h1>{t('البحث عن درس', 'Search lessons')}</h1>
    <input className="learn-input" type="search" aria-label={t('البحث عن درس', 'Search lessons')}
      placeholder={t('ابحث عن درس...', 'Search lessons...')} value={query}
      onChange={(e) => {
        const value = e.target.value;
        setQuery(value);
        window.history.replaceState(null, '', `${window.location.pathname}${value ? `?q=${encodeURIComponent(value)}` : ''}`);
      }} />
    {status === 'loading' && <p role="status">{t('جاري البحث...', 'Searching...')}</p>}
    {status === 'error' && <p role="alert">{t('تعذر البحث الآن.', 'Search failed.')} <button className="btn" onClick={() => setRetry(n => n + 1)}>{t('إعادة المحاولة', 'Try again')}</button></p>}
    {status === 'idle' && query.trim() && results.length === 0 && <p>{t('لا توجد نتائج', 'No results')}</p>}
    {!query.trim() && <p>{t('اكتب اسم الدرس للبحث.', 'Enter a lesson name to search.')}</p>}
    {results.map(r => <Link key={r.id} className="kid-search-result" href={path(`/learn/${childId}/lessons/${r.id}`)}>
      <span>{r.subjectIcon}</span>
      <div><div>{content(r.titleAr, r.titleEn)}</div><small>{content(r.subjectNameAr, r.subjectNameEn)} · {r.durationMinutes} {t('دقيقة', 'min')}</small></div>
      {r.completed && <span aria-label={t('مكتمل', 'Completed')}>✓</span>}
    </Link>)}
  </div>;
}
