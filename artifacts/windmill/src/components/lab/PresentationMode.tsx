import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { ArrowDefs, STILL, WindmillModel } from '@/components/model/WindmillModel';
import type { Lesson } from '@/data/lessons/windmill';
import type { Language } from '@/lib/lesson-engine';
import type { FxStrings } from '@/i18n/features';
import type { Strings } from '@/i18n/ui';

/** Full-screen instructor view with its own step counter. Never reads or writes learner progress. */
export function PresentationMode({ lesson, lang, f, t, onExit, startAt = 0 }: {
  lesson: Lesson; lang: Language; f: FxStrings; t: Strings; onExit: () => void; startAt?: number;
}) {
  const total = lesson.steps.length;
  const [count, setCount] = useState(startAt);
  const [pop, setPop] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const exitRef = useRef(onExit); exitRef.current = onExit;
  const go = (d: number) => setCount((c) => { const n = Math.max(0, Math.min(total, c + d)); if (n > c) setPop((p) => p + 1); return n; });
  const goRef = useRef(go); goRef.current = go;

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    root.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (e.key === 'Tab') {
        const buttons = Array.from(root.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
        if (first && (el === root.current || !root.current?.contains(el) || (e.shiftKey && el === first) || (!e.shiftKey && el === last))) {
          e.preventDefault();
          (e.shiftKey ? last : first).focus();
        }
        return;
      }
      if (el?.closest('input, select, textarea, [contenteditable="true"], [role="dialog"]:not(.pres)')) {
        if (e.key !== 'Escape' || el.closest('[role="dialog"]:not(.pres)')) return;
      }
      if (e.key === 'Escape') { e.preventDefault(); exitRef.current(); return; }
      const rtl = document.documentElement.dir === 'rtl';
      if (e.key === 'ArrowRight') { e.preventDefault(); goRef.current(rtl ? -1 : 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goRef.current(rtl ? 1 : -1); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; opener?.focus(); };
  }, []);

  const placed = lesson.steps.slice(0, count).map((s) => s.id);
  const last = count > 0 ? lesson.steps[count - 1] : null;
  const next = lesson.steps[count];
  const VB = lesson.viewBox;
  return (
    <div ref={root} className="pres" role="dialog" aria-modal="true" aria-label={f.presTitle} tabIndex={-1} data-testid="presentation">
      <div className="pres-bar" role="toolbar" aria-label={f.presToolbar}>
        <span className="pres-title">{lesson.code} · {lesson.title[lang]}</span>
        <span className="mono pres-count" data-testid="presentation-count">{f.presStep(count, total)}</span>
        <button type="button" className="btn btn-small" disabled={count === 0} onClick={() => go(-1)} data-testid="presentation-prev">
          <ChevronLeft size={18} className="flip-rtl" aria-hidden="true" />{f.presPrev}
        </button>
        <button type="button" className="btn btn-small" disabled={count >= total} onClick={() => go(1)} data-testid="presentation-next">
          {f.presNext}<ChevronRight size={18} className="flip-rtl" aria-hidden="true" />
        </button>
        <button type="button" className="btn btn-danger" onClick={onExit} data-testid="presentation-exit"><X size={18} aria-hidden="true" />{f.presExit}</button>
      </div>
      <div className="pres-body">
        <div className="pres-model" dir="ltr">
          <svg viewBox={`${VB.x} ${VB.y} ${VB.w} ${VB.h}`} role="img" aria-label={`${t.matSr} ${t.progressSr(count, total)}`}>
            <ArrowDefs />
            <WindmillModel lesson={lesson} placed={placed} motion={STILL} newest={last?.id ?? null} popKey={pop} />
          </svg>
        </div>
        <div className="pres-text" aria-live="polite" data-testid="presentation-instruction">
          {count === 0 && <p className="pres-sub">{f.presEmpty}</p>}
          {last && (
            <>
              <p className="step-of">{t.stepOf(last.number, total)}</p>
              <h2 className="pres-h">{last.title[lang]}</h2>
              <p className="pres-p">{last.instruction[lang]}</p>
            </>
          )}
          {!next && <p className="pres-sub">{t.doneBody}</p>}
          <p className="muted small">{f.presKeys} {f.presSeparate}</p>
        </div>
      </div>
    </div>
  );
}
