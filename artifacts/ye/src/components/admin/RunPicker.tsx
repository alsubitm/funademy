'use client';

import { useEffect, useId, useRef, useState } from 'react';

export type RunOption = {
  id: number;
  titleAr: string | null;
  time: string;
  startDate: string;
  program: { id: number; nameAr: string };
};

export function runLabel(r: RunOption) {
  return `${r.program?.nameAr} — ${r.titleAr || r.time} · #${r.id}`;
}

/**
 * Accessible combobox over active course runs. The server searches and pages
 * (`/svc/admin/runs?options=1`), so older runs stay reachable regardless of volume.
 * The chosen run object is held by the parent, independent of the current results.
 */
export function RunPicker({ value, onChange }: { value: RunOption | null; onChange: (run: RunOption) => void }) {
  const listId = useId();
  const inputId = useId();
  const statusId = useId();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [runs, setRuns] = useState<RunOption[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [active, setActive] = useState(-1);
  const seq = useRef(0);
  const wrapRef = useRef<HTMLDivElement>(null);

  const load = async (q: string, cursor: string | null) => {
    const mine = ++seq.current;
    setState('loading');
    const params = new URLSearchParams({ options: '1', limit: '20' });
    if (q.trim()) params.set('rq', q.trim());
    if (cursor) params.set('cursor', cursor);
    try {
      const res = await fetch(`/svc/admin/runs?${params}`);
      if (res.status === 401) { window.location.reload(); return; }
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      if (mine !== seq.current) return;
      setRuns((prev) => (cursor ? [...prev, ...data.runs] : data.runs));
      setNextCursor(data.nextCursor ?? null);
      if (!cursor) setActive(data.runs.length ? 0 : -1);
      setState('idle');
    } catch {
      if (mine === seq.current) setState('error');
    }
  };

  // Debounced server search while the list is open.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => load(query, null), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  });

  const close = () => { setOpen(false); setQuery(''); setActive(-1); };
  const choose = (r: RunOption) => { onChange(r); close(); };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) { setOpen(true); return; }
      if (active >= runs.length - 1 && nextCursor && state === 'idle') load(query, nextCursor);
      setActive((i) => Math.min(i + 1, runs.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      if (open && runs[active]) { e.preventDefault(); choose(runs[active]); }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); close(); }
    }
  };

  const status = state === 'loading' ? 'جارٍ البحث…'
    : state === 'error' ? 'تعذّر تحميل الدفعات، حاول مجدداً'
    : open ? (runs.length ? `${runs.length} دفعة${nextCursor ? ' — توجد نتائج أخرى' : ''}` : 'لا توجد دفعات نشطة مطابقة') : '';

  return (
    <div
      ref={wrapRef}
      className="relative"
      onBlur={(e) => { if (!wrapRef.current?.contains(e.relatedTarget as Node | null)) close(); }}
    >
      <label htmlFor={inputId} className="block text-[13px] font-bold text-[#5F6B92] mb-2">الدفعة</label>
      <input
        id={inputId}
        data-testid="input-progress-run"
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-describedby={statusId}
        aria-activedescendant={open && runs[active] ? `${listId}-${runs[active].id}` : undefined}
        autoComplete="off"
        className="input-hq"
        placeholder={value ? runLabel(value) : 'ابحث بالبرنامج أو العنوان أو الوقت أو #الرقم…'}
        value={open ? query : value ? runLabel(value) : ''}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onKeyDown={onKeyDown}
      />
      <div id={statusId} role="status" aria-live="polite" className="sr-only">{status}</div>
      {open && (
        <div className="absolute z-20 mt-2 w-full bg-white border border-[#DFE5F2] rounded-2xl shadow-[0_8px_30px_rgba(7,17,42,0.12)] overflow-hidden">
          <ul id={listId} role="listbox" aria-label="الدفعات النشطة" className="max-h-72 overflow-y-auto py-1" data-testid="list-progress-runs">
            {runs.map((r, i) => (
              <li
                key={r.id}
                id={`${listId}-${r.id}`}
                role="option"
                aria-selected={value?.id === r.id}
                data-testid={`option-progress-run-${r.id}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(r)}
                onMouseEnter={() => setActive(i)}
                className={`px-4 py-2.5 cursor-pointer text-sm font-bold ${i === active ? 'bg-[#F0F5FF] text-[#1C54CB]' : 'text-[#101A38]'}`}
              >
                {runLabel(r)}
              </li>
            ))}
          </ul>
          <div className="px-4 py-2 border-t border-[#DFE5F2] flex items-center justify-between gap-3 text-xs font-bold text-[#5F6B92]">
            <span aria-hidden="true">{status}</span>
            {nextCursor && (
              <button
                type="button"
                data-testid="button-progress-runs-more"
                aria-disabled={state === 'loading'}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { if (state !== 'loading') load(query, nextCursor); }}
                className="text-[#1C54CB] hover:underline"
              >
                عرض المزيد
              </button>
            )}
            {state === 'error' && (
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => load(query, null)} className="text-[#1C54CB] hover:underline">
                إعادة المحاولة
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
