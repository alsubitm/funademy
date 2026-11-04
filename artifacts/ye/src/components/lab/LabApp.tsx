'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as RPointerEvent } from 'react';
import { currentStep, getPart, getSlot, placePart, placementsForSteps, remaining, removePart, simulate, totalPieces, validatePlacements } from '@/lib/lab/engine';
import type { Simulation } from '@/lib/lab/engine';
import type { Lang, Lesson, Placements, Text } from '@/lib/lab/types';
import { PartArt, Workbench } from './Mechanism';
import './lab.css';

const UI = {
  home: { ar: 'الرئيسية', en: 'Home' },
  langSwitch: { ar: 'English', en: 'العربية' },
  student: { ar: 'وضع الطالب', en: 'Student' },
  demo: { ar: 'عرض المعلم', en: 'Instructor demo' },
  step: { ar: 'الخطوة', en: 'Step' },
  allPlaced: { ar: 'كل القطع في مكانها. اضغط «اختبر نموذجي».', en: 'Every piece is in. Press “Test my model”.' },
  tray: { ar: 'صينية القطع', en: 'Parts tray' },
  pieces: { ar: 'قطع', en: 'pieces' },
  rotate: { ar: 'تدوير', en: 'Rotate' },
  remove: { ar: 'إزالة', en: 'Remove' },
  undo: { ar: 'تراجع', en: 'Undo' },
  reset: { ar: 'إعادة', en: 'Reset' },
  resetConfirm: { ar: 'اضغط مجددًا للمسح', en: 'Tap again to clear' },
  hint: { ar: 'تلميح', en: 'Hint' },
  hint2: { ar: 'أرني المكان', en: 'Show me where' },
  test: { ar: 'اختبر نموذجي', en: 'Test my model' },
  stop: { ar: 'إيقاف', en: 'Stop' },
  finished: { ar: 'صورة النموذج المكتمل', en: 'Finished model' },
  pickHelp: { ar: 'اختر قطعة ثم اضغط نقطة مضيئة، أو اسحبها إلى الطاولة.', en: 'Pick a part, then tap a glowing point — or drag it onto the bench.' },
  facing: { ar: 'الاتجاه', en: 'Facing' },
  placedSel: { ar: 'قطعة مختارة على الطاولة', en: 'Selected on the bench' },
  snapped: { ar: 'ثبتت في مكانها!', en: 'Snapped in!' },
  removed: { ar: 'أُعيدت القطعة إلى الصينية.', en: 'Piece returned to the tray.' },
  blocked: { ar: 'أزل القطع المركّبة فوقها أولًا.', en: 'Remove the pieces attached to it first.' },
  undone: { ar: 'تم التراجع عن آخر خطوة.', en: 'Last action undone.' },
  cleared: { ar: 'الطاولة فارغة من جديد.', en: 'The bench is empty again.' },
  missedDrop: { ar: 'لم تصل القطعة إلى نقطة تثبيت، فعادت إلى الصينية.', en: 'It did not reach an attachment point, so it went back to the tray.' },
  restored: { ar: 'استعدنا بناءك المحفوظ على هذا الجهاز.', en: 'Your saved build on this device is back.' },
  doneTitle: { ar: 'المروحة تدور!', en: 'The fan spins!' },
  replay: { ar: 'إعادة التشغيل', en: 'Replay' },
  keepBuilding: { ar: 'العودة إلى الطاولة', en: 'Back to the bench' },
  summary: { ar: 'ملخص النشاط', en: 'Activity summary' },
  status: { ar: 'الحالة', en: 'Status' },
  complete: { ar: 'مكتمل', en: 'Complete' },
  inProgress: { ar: 'قيد البناء', en: 'In progress' },
  time: { ar: 'الوقت', en: 'Time' },
  hintsUsed: { ar: 'التلميحات', en: 'Hints used' },
  right: { ar: 'صحيح!', en: 'Right!' },
  tryAgain: { ar: 'انظر إلى الأسهم في الإعادة وجرّب مجددًا.', en: 'Watch the arrows in the replay and try again.' },
  prev: { ar: 'السابق', en: 'Back' },
  next: { ar: 'التالي', en: 'Next' },
  run: { ar: 'تشغيل', en: 'Run' },
  demoNote: { ar: 'عرض منفصل: لا يغيّر بناء الطالب ولا يُحفظ.', en: 'Separate view: never changes or saves the student build.' },
  storageOff: { ar: 'تعذّر الحفظ على هذا الجهاز؛ سيضيع التقدم عند التحديث.', en: 'Saving is unavailable on this device; progress will be lost on refresh.' },
  local: { ar: 'يُحفظ التقدم على هذا الجهاز فقط. لا نجمع أسماء أو بيانات.', en: 'Progress stays on this device only. No names or contact details collected.' },
  objective: { ar: 'الهدف', en: 'Goal' },
};

type Msg = { tone: 'ok' | 'err' | 'info' | 'win'; text: string } | null;
type Sel = { kind: 'tray'; partId: string } | { kind: 'placed'; slotId: string } | null;
interface Saved { v: 1; lesson: string; version: number; placements: Placements; hintsUsed: number; startedAt: number; completedAt: number | null }

const fmtTime = (ms: number, lang: Lang) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(s / 60);
  return lang === 'ar' ? `${m} د ${s % 60} ث` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
};

function useReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(mq.matches);
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

/** Drives the rotation angle while `running`. Reduced motion: discrete 30° ticks (still shows direction). */
function useTheta(running: boolean, reduced: boolean) {
  const [theta, setTheta] = useState(0);
  useEffect(() => {
    if (!running) return;
    if (reduced) {
      const id = window.setInterval(() => setTheta((t) => t + 30), 450);
      return () => window.clearInterval(id);
    }
    let raf = 0; let last = performance.now();
    const loop = (now: number) => { setTheta((t) => t + ((now - last) / 1000) * 140); last = now; raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running, reduced]);
  return theta;
}

export function LabApp({ lesson, lang }: { lesson: Lesson; lang: Lang }) {
  const t = (x: Text) => x[lang];
  const storageKey = `funademy-lab:${lesson.id}:v${lesson.version}`;
  const reduced = useReducedMotion();

  const [placements, setPlacements] = useState<Placements>({});
  const [history, setHistory] = useState<Placements[]>([]);
  const [sel, setSel] = useState<Sel>(null);
  const [orient, setOrient] = useState<Record<string, number>>({});
  const [hintStage, setHintStage] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [startedAt, setStartedAt] = useState<number>(0);
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [flash, setFlash] = useState<{ slot: string; tone: 'ok' | 'err' } | null>(null);
  const [sim, setSim] = useState<Simulation | null>(null);
  const [running, setRunning] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [mode, setMode] = useState<'student' | 'demo'>('student');
  const [demoStep, setDemoStep] = useState(0);
  const [demoRun, setDemoRun] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storageOk, setStorageOk] = useState(true);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(0);
  const [drag, setDrag] = useState<{ partId: string; x: number; y: number } | null>(null);
  const dragStart = useRef<{ partId: string; x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const boardRef = useRef<HTMLDivElement>(null);

  const theta = useTheta(running || demoRun, reduced);

  // Restore
  useEffect(() => {
    let restored = false;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const s = JSON.parse(raw) as Partial<Saved>;
        const p = s && s.v === 1 && s.lesson === lesson.id && s.version === lesson.version ? validatePlacements(lesson, s.placements) : null;
        if (p) {
          setPlacements(p);
          setHintsUsed(typeof s.hintsUsed === 'number' && s.hintsUsed >= 0 ? Math.floor(s.hintsUsed) : 0);
          setStartedAt(typeof s.startedAt === 'number' && s.startedAt <= Date.now() ? s.startedAt : Date.now());
          setCompletedAt(typeof s.completedAt === 'number' ? s.completedAt : null);
          restored = Object.keys(p).length > 0;
        } else localStorage.removeItem(storageKey);
      }
    } catch { setStorageOk(false); }
    if (!restored) setStartedAt(Date.now());
    else setMsg({ tone: 'info', text: t(UI.restored) });
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist
  useEffect(() => {
    if (!loaded) return;
    const s: Saved = { v: 1, lesson: lesson.id, version: lesson.version, placements, hintsUsed, startedAt, completedAt };
    try { localStorage.setItem(storageKey, JSON.stringify(s)); } catch { setStorageOk(false); }
  }, [loaded, placements, hintsUsed, startedAt, completedAt, lesson.id, lesson.version, storageKey]);

  useEffect(() => { setNow(Date.now()); const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);

  const step = useMemo(() => currentStep(lesson, placements), [lesson, placements]);
  const stepIndex = step ? lesson.steps.indexOf(step) : lesson.steps.length;
  useEffect(() => { setHintStage(0); }, [step?.id]);

  const flashSlot = (slot: string, tone: 'ok' | 'err') => { setFlash({ slot, tone }); window.setTimeout(() => setFlash(null), 700); };
  const stopTest = () => { setRunning(false); setSim(null); };

  const syncCompletion = (next: Placements) => { if (!simulate(lesson, next).success) setCompletedAt(null); };
  const commit = (next: Placements) => { setHistory((h) => [...h.slice(-40), placements]); setPlacements(next); syncCompletion(next); stopTest(); setShowDone(false); };

  const orientationOf = (partId: string) => { const part = getPart(lesson, partId)!; return part.orientations[(orient[partId] ?? 0) % part.orientations.length]; };

  const attempt = (partId: string, slotId: string) => {
    const r = placePart(lesson, placements, partId, slotId, orientationOf(partId));
    if (r.ok) {
      commit(r.placements);
      setSel(null);
      flashSlot(slotId, 'ok');
      setMsg({ tone: 'ok', text: t(UI.snapped) });
    } else {
      flashSlot(slotId, 'err');
      const slot = getSlot(lesson, slotId);
      const extra = r.reason === 'missing-dependency' && slot ? ` ${t(slot.requiresHint)}` : '';
      setMsg({ tone: 'err', text: t(lesson.reasons[r.reason]) + extra });
    }
  };

  const onSlot = (slotId: string) => { if (sel?.kind === 'tray') attempt(sel.partId, slotId); };
  const onPlaced = (slotId: string) => { setSel((s) => (s?.kind === 'placed' && s.slotId === slotId ? null : { kind: 'placed', slotId })); };

  const removeSelected = () => {
    if (sel?.kind !== 'placed') return;
    const r = removePart(lesson, placements, sel.slotId);
    if (r.ok) { commit(r.placements); setSel(null); setMsg({ tone: 'info', text: t(UI.removed) }); }
    else { flashSlot(sel.slotId, 'err'); setMsg({ tone: 'err', text: t(UI.blocked) }); }
  };
  const undo = () => {
    if (!history.length) return;
    const prev = history[history.length - 1]; syncCompletion(prev);
    setPlacements(prev); setHistory((h) => h.slice(0, -1)); setSel(null); stopTest(); setShowDone(false);
    setMsg({ tone: 'info', text: t(UI.undone) });
  };
  const reset = () => {
    if (!confirmReset) { setConfirmReset(true); return; }
    setConfirmReset(false); setPlacements({}); setHistory([]); setSel(null); stopTest(); setShowDone(false); setAnswer(null);
    setHintsUsed(0); setStartedAt(Date.now()); setCompletedAt(null); setOrient({});
    setMsg({ tone: 'info', text: t(UI.cleared) });
  };
  const rotate = () => { if (sel?.kind === 'tray') setOrient((o) => ({ ...o, [sel.partId]: (o[sel.partId] ?? 0) + 1 })); };
  const hint = () => {
    if (!step || hintStage >= 2) return;
    setHintStage((h) => h + 1); setHintsUsed((n) => n + 1);
  };
  const test = () => {
    if (running) { stopTest(); return; }
    const s = simulate(lesson, placements);
    setSel(null); setSim(s); setRunning(true); setAnswer(null);
    setMsg({ tone: s.success ? 'win' : 'err', text: t(lesson.status[s.status]) });
    if (s.success) {
      setCompletedAt((c) => c ?? Date.now());
    }
  };
  const replay = () => { setShowDone(false); setSim(simulate(lesson, placements)); setRunning(true); };

  // Completion pops only while the current successful simulation is still running; cleanup kills stale timers.
  useEffect(() => {
    if (mode !== 'student' || !running || !sim?.success) return;
    const id = window.setTimeout(() => setShowDone(true), reduced ? 2400 : 1800);
    return () => window.clearTimeout(id);
  }, [mode, running, sim, reduced]);

  // Dialog focus: enter, trap, Escape, restore.
  const dialogOpen = showDone && mode === 'student';
  useEffect(() => {
    if (!dialogOpen) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const card = dialogRef.current;
    const focusables = () => Array.from(card?.querySelectorAll<HTMLElement>('button:not([disabled])') ?? []);
    focusables()[0]?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); setShowDone(false); return; }
      if (e.key !== 'Tab') return;
      const f = focusables(); if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || !card?.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && (document.activeElement === last || !card?.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); if (prevFocus && document.contains(prevFocus)) prevFocus.focus(); };
  }, [dialogOpen]);

  // Pointer drag from tray
  const onTrayDown = (partId: string) => (e: RPointerEvent) => {
    if (e.button !== 0 || remaining(lesson, placements, partId) <= 0) return;
    dragStart.current = { partId, x: e.clientX, y: e.clientY, moved: false };
  };
  const endDrag = useCallback((x: number, y: number, attemptFn: (p: string, s: string) => void, onMiss: () => void) => {
    const d = dragStart.current; dragStart.current = null; setDrag(null);
    if (!d || !d.moved) return;
    suppressClick.current = true; window.setTimeout(() => { suppressClick.current = false; }, 50);
    const el = document.elementFromPoint(x, y);
    const slot = el?.closest('[data-slot]')?.getAttribute('data-slot');
    if (slot) attemptFn(d.partId, slot); else onMiss();
  }, []);
  const attemptRef = useRef(attempt); attemptRef.current = attempt;
  const missRef = useRef(() => {}); missRef.current = () => setMsg({ tone: 'err', text: t(UI.missedDrop) });
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = dragStart.current; if (!d) return;
      if (!d.moved && Math.hypot(e.clientX - d.x, e.clientY - d.y) > 8) { d.moved = true; setSel({ kind: 'tray', partId: d.partId }); }
      if (d.moved) { e.preventDefault(); setDrag({ partId: d.partId, x: e.clientX, y: e.clientY }); }
    };
    const up = (e: PointerEvent) => endDrag(e.clientX, e.clientY, (p, s) => attemptRef.current(p, s), () => missRef.current());
    const cancel = () => { dragStart.current = null; setDrag(null); };
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', cancel); };
  }, [endDrag]);

  const trayClick = (partId: string) => {
    if (suppressClick.current) return;
    if (remaining(lesson, placements, partId) <= 0) { setMsg({ tone: 'err', text: t(lesson.reasons['none-left']) }); return; }
    setSel((s) => (s?.kind === 'tray' && s.partId === partId ? null : { kind: 'tray', partId }));
    stopTest();
  };

  const slotLabel = (slotId: string) => {
    const s = getSlot(lesson, slotId); const part = s && getPart(lesson, s.accepts);
    return part ? `${t(part.name)} — ${slotId}` : slotId;
  };

  const demoPlacements = useMemo(() => placementsForSteps(lesson, demoStep), [lesson, demoStep]);
  const demoSim = useMemo(() => (demoRun ? simulate(lesson, demoPlacements) : null), [demoRun, lesson, demoPlacements]);
  const finishedPlacements = useMemo(() => placementsForSteps(lesson, lesson.steps.length), [lesson]);

  const selectedPart = sel?.kind === 'tray' ? getPart(lesson, sel.partId) : sel?.kind === 'placed' ? getPart(lesson, placements[sel.slotId]?.partId ?? '') : undefined;
  const hintSlot = step && hintStage >= 2 ? step.slot : null;
  const hintPart = step && hintStage >= 1 ? getSlot(lesson, step.slot)?.accepts ?? null : null;
  const elapsed = (completedAt ?? now) - startedAt;
  const placedCount = Object.keys(placements).length;
  const total = totalPieces(lesson);
  const other = lang === 'ar' ? '/en/lab' : '/lab';

  return (
    <div className="engineering-lab" dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} data-testid="lab-root">
      <header className="lab-top">
        <Link href={lang === 'ar' ? '/' : '/en'} className="lab-brand" data-testid="link-lab-home">Fun<span>Ademy</span><small>{t(UI.home)}</small></Link>
        <div className="lab-modes" role="tablist">
          <button role="tab" aria-selected={mode === 'student'} className={mode === 'student' ? 'on' : ''} onClick={() => { setMode('student'); setDemoRun(false); }} data-testid="button-mode-student">{t(UI.student)}</button>
          <button role="tab" aria-selected={mode === 'demo'} className={mode === 'demo' ? 'on' : ''} onClick={() => { setMode('demo'); stopTest(); setSel(null); }} data-testid="button-mode-demo">{t(UI.demo)}</button>
        </div>
        <Link href={other} className="lab-lang" lang={lang === 'ar' ? 'en' : 'ar'} data-testid="link-lab-language">{t(UI.langSwitch)}</Link>
      </header>

      <section className="lab-intro">
        <p className="lab-badge" data-testid="text-lab-badge">{t(lesson.badge)}</p>
        <h1 data-testid="text-lab-title">{t(lesson.title)}</h1>
        <p className="lab-obj"><b>{t(UI.objective)}:</b> {t(lesson.objective)} <span className="lab-mins">{lesson.minutes} {lang === 'ar' ? 'دقيقة' : 'min'}</span></p>
      </section>

      {mode === 'demo' ? (
        <section className="lab-demo" data-testid="panel-demo">
          <div className="lab-instr">
            <span className="lab-stepnum">{t(UI.step)} {demoStep}/{lesson.steps.length}</span>
            <p data-testid="text-demo-step">{demoStep === 0 ? t(UI.pickHelp) : t(lesson.steps[demoStep - 1].text)}</p>
          </div>
          <div className="lab-board" data-testid="board-demo">
            <Workbench lesson={lesson} placements={demoPlacements} theta={theta} moving={demoSim?.moving ?? null} axesTurning={demoSim?.axes ?? null} selectedPart={null} selectedSlot={null} hintSlot={null} flash={null} interactive={false} slotLabel={slotLabel} />
            {demoSim && <p className={`lab-toast ${demoSim.success ? 'win' : 'err'}`} data-testid="status-demo">{t(lesson.status[demoSim.status])}</p>}
          </div>
          <div className="lab-controls">
            <button className="lab-btn" disabled={demoStep === 0} onClick={() => { setDemoStep((n) => n - 1); setDemoRun(false); }} data-testid="button-demo-prev">{t(UI.prev)}</button>
            <button className="lab-btn" disabled={demoStep >= lesson.steps.length} onClick={() => { setDemoStep((n) => n + 1); setDemoRun(false); }} data-testid="button-demo-next">{t(UI.next)}</button>
            <button className="lab-btn lab-go" onClick={() => setDemoRun((r) => !r)} data-testid="button-demo-run">{demoRun ? t(UI.stop) : t(UI.run)}</button>
          </div>
          <p className="lab-fine">{t(UI.demoNote)}</p>
        </section>
      ) : (
        <div className="lab-main">
          <section className="lab-stage">
            <div className="lab-instr" data-testid="panel-instruction">
              <span className="lab-stepnum" data-testid="text-step-count">{t(UI.step)} {Math.min(stepIndex + 1, lesson.steps.length)}/{lesson.steps.length}</span>
              <p data-testid="text-instruction">{step ? t(step.text) : t(UI.allPlaced)}</p>
              {step && (
                <button className="lab-hint" onClick={hint} disabled={hintStage >= 2} data-testid="button-hint">
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" /></svg>
                  {hintStage === 0 ? t(UI.hint) : t(UI.hint2)}
                </button>
              )}
              {step && hintStage > 0 && <p className="lab-hinttext" data-testid="text-hint">{t(step.hints[Math.min(hintStage, 2) - 1])}</p>}
            </div>

            <div className={`lab-board${drag ? ' is-dragging' : ''}`} ref={boardRef} data-testid="board-student">
              <Workbench lesson={lesson} placements={placements} theta={theta} moving={running ? sim?.moving ?? null : null} axesTurning={running ? sim?.axes ?? null : null}
                selectedPart={sel?.kind === 'tray' ? sel.partId : null} selectedSlot={sel?.kind === 'placed' ? sel.slotId : null}
                hintSlot={hintSlot} flash={flash} interactive slotLabel={slotLabel} onSlot={onSlot} onPlaced={onPlaced} />
              <figure className="lab-preview" aria-label={t(UI.finished)}>
                <Workbench lesson={lesson} placements={finishedPlacements} theta={0} moving={null} axesTurning={null} selectedPart={null} selectedSlot={null} hintSlot={null} flash={null} interactive={false} slotLabel={slotLabel} />
                <figcaption>{t(UI.finished)}</figcaption>
              </figure>
              {msg && <p className={`lab-toast ${msg.tone}`} role="status" aria-live="polite" data-testid="status-message">{msg.text}</p>}
            </div>

            <div className="lab-controls">
              <button className="lab-btn" onClick={rotate} disabled={sel?.kind !== 'tray' || (selectedPart?.orientations.length ?? 0) < 2} data-testid="button-rotate">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.3-5.6M20 4v5h-5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>{t(UI.rotate)}
              </button>
              <button className="lab-btn" onClick={removeSelected} disabled={sel?.kind !== 'placed'} data-testid="button-remove">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>{t(UI.remove)}
              </button>
              <button className="lab-btn" onClick={undo} disabled={!history.length} data-testid="button-undo">
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" className="lab-flip"><path d="M9 14 4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>{t(UI.undo)}
              </button>
              <button className={`lab-btn${confirmReset ? ' warn' : ''}`} onClick={reset} data-testid="button-reset">{confirmReset ? t(UI.resetConfirm) : t(UI.reset)}</button>
              <button className={`lab-btn lab-go${running ? ' is-running' : ''}`} onClick={test} data-testid="button-test">
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d={running ? 'M7 6h4v12H7zM13 6h4v12h-4z' : 'M8 5v14l11-7z'} fill="currentColor" /></svg>{running ? t(UI.stop) : t(UI.test)}
              </button>
            </div>
          </section>

          <aside className="lab-side">
            <div className="lab-trayhead">
              <h2>{t(UI.tray)}</h2>
              <span data-testid="text-inventory">{total - placedCount}/{total} {t(UI.pieces)}</span>
            </div>
            <ul className="lab-tray" data-testid="list-tray">
              {lesson.parts.map((part) => {
                const left = remaining(lesson, placements, part.id);
                const o = orientationOf(part.id);
                const isSel = sel?.kind === 'tray' && sel.partId === part.id;
                return (
                  <li key={part.id}>
                    <button className={`lab-part${isSel ? ' is-selected' : ''}${left === 0 ? ' is-empty' : ''}${hintPart === part.id ? ' is-hint' : ''}`}
                      onClick={() => trayClick(part.id)} onPointerDown={onTrayDown(part.id)} aria-pressed={isSel}
                      data-testid={`tray-part-${part.id}`} data-part={part.id} data-remaining={left}>
                      <PartArt partId={part.id} orientation={o} size={56} />
                      <span className="lab-pname">{t(part.name)}</span>
                      <span className="lab-qty" data-testid={`text-qty-${part.id}`}>×{left}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="lab-info" data-testid="panel-part-info">
              {selectedPart ? (
                <>
                  <h3>{sel?.kind === 'placed' ? `${t(UI.placedSel)}: ` : ''}{t(selectedPart.name)}</h3>
                  <p>{t(selectedPart.description)}</p>
                  {sel?.kind === 'tray' && selectedPart.orientations.length > 1 && (
                    <p className="lab-orient" data-testid="text-orientation">{t(UI.facing)}: <b>{t(lesson.orientationNames[orientationOf(selectedPart.id)] ?? { ar: '', en: '' })}</b></p>
                  )}
                </>
              ) : <p>{t(UI.pickHelp)}</p>}
            </div>
            <dl className="lab-summary" data-testid="panel-summary">
              <div><dt>{t(UI.status)}</dt><dd data-testid="text-summary-status">{completedAt ? t(UI.complete) : t(UI.inProgress)}</dd></div>
              <div><dt>{t(UI.time)}</dt><dd data-testid="text-summary-time">{startedAt ? fmtTime(elapsed, lang) : '—'}</dd></div>
              <div><dt>{t(UI.hintsUsed)}</dt><dd data-testid="text-summary-hints">{hintsUsed}</dd></div>
            </dl>
            <p className="lab-fine" role={storageOk ? undefined : 'alert'} data-testid="text-storage">{storageOk ? t(UI.local) : t(UI.storageOff)}</p>
          </aside>
        </div>
      )}

      {drag && (
        <div className="lab-ghost" style={{ transform: `translate(${drag.x - 36}px, ${drag.y - 36}px)` }} aria-hidden="true">
          <PartArt partId={drag.partId} orientation={orientationOf(drag.partId)} size={72} />
        </div>
      )}

      {dialogOpen && (
        <div className="lab-done" role="dialog" aria-modal="true" aria-labelledby="lab-done-title" data-testid="dialog-complete">
          <div className="lab-donecard" ref={dialogRef}>
            <h2 id="lab-done-title">{t(UI.doneTitle)}</h2>
            <p className="lab-q">{t(lesson.reflection.question)}</p>
            <div className="lab-opts">
              {lesson.reflection.options.map((o) => (
                <button key={o.id} className={`lab-opt${answer === o.id ? (o.id === lesson.reflection.correct ? ' right' : ' wrong') : ''}`} onClick={() => setAnswer(o.id)} data-testid={`button-answer-${o.id}`}>{t(o.label)}</button>
              ))}
            </div>
            {answer && <p className="lab-explain" data-testid="text-reflection-feedback">{answer === lesson.reflection.correct ? `${t(UI.right)} ${t(lesson.reflection.explain)}` : t(UI.tryAgain)}</p>}
            <dl className="lab-summary">
              <div><dt>{t(UI.status)}</dt><dd>{t(UI.complete)}</dd></div>
              <div><dt>{t(UI.time)}</dt><dd data-testid="text-complete-time">{fmtTime(elapsed, lang)}</dd></div>
              <div><dt>{t(UI.hintsUsed)}</dt><dd data-testid="text-complete-hints">{hintsUsed}</dd></div>
            </dl>
            <div className="lab-controls">
              <button className="lab-btn lab-go" onClick={replay} data-testid="button-replay">{t(UI.replay)}</button>
              <button className="lab-btn" onClick={() => setShowDone(false)} data-testid="button-close-complete">{t(UI.keepBuilding)}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
