import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { BookOpen, Check, ChevronLeft, ChevronRight, Cog, Eye, FlaskConical, History, Languages, Lightbulb, Lock, MonitorPlay, Play, Presentation, RotateCcw, ScanSearch, Square, Undo2, X } from 'lucide-react';
import { addHint, demoProgress, isComplete, placeSet, reset, testMotor, undo, type Language } from '@/lib/lesson-engine';
import { windmillLesson as lesson, type LessonStep } from '@/data/lessons/windmill';
import { UI } from '@/i18n/ui';
import { useStoredProgress } from '@/hooks/use-stored-progress';
import { ArrowDefs, LayerArt, STILL, WindmillModel, type Motion } from '@/components/model/WindmillModel';
import { Dialog } from '@/components/Dialog';
import { FunAdemyWordmark } from '@/components/brand/FunAdemyMark';
import { FX } from '@/i18n/features';
import { transmissionMotion } from '@/lib/motor-controls';
import { useMotor } from '@/hooks/use-motor';
import { useNarration } from '@/hooks/use-narration';
import { MotorControls } from '@/components/lab/MotorControls';
import { NarrationControl } from '@/components/lab/NarrationControl';
import { InspectDialog } from '@/components/lab/InspectDialog';
import { ChallengeDialog } from '@/components/lab/ChallengeDialog';
import { PresentationMode } from '@/components/lab/PresentationMode';
import { OfflineNotice } from '@/components/OfflineNotice';

type FeedbackKind = 'ok' | 'warn' | 'info';
const VB = lesson.viewBox;
const vbStr = `${VB.x} ${VB.y} ${VB.w} ${VB.h}`;
const pct = (v: number, o: number, s: number) => `${((v - o) / s) * 100}%`;

function useReducedMotion() {
  const [r, setR] = useState(() => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setR(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return r;
}

function PartThumb({ step }: { step: LessonStep }) {
  const b = step.svgLayer.bbox;
  const pad = 8;
  return (
    <svg viewBox={`${b.x - pad} ${b.y - pad - 6} ${b.w + pad * 2} ${b.h + pad * 2 + 6}`} className="thumb" aria-hidden="true" focusable="false">
      <LayerArt id={step.svgLayer.id} lesson={lesson} />
    </svg>
  );
}

export default function Lab() {
  const { progress, setProgress, notice, dismissNotice } = useStoredProgress(lesson);
  const lang: Language = progress.language;
  const t = UI[lang];
  const f = FX[lang];
  const reduced = useReducedMotion();
  const tr = lesson.transmission;
  const motor = useMotor(tr.driverRpm, reduced);
  const running = motor.running;
  const narration = useNarration(lang);
  const motorStopRef = useRef(motor.stop); motorStopRef.current = motor.stop;
  const [popKey, setPopKey] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);
  const previewTimer = useRef<number | null>(null);
  const [presenting, setPresenting] = useState(false);

  const [demo, setDemo] = useState<{ on: boolean; count: number }>({ on: false, count: 0 });
  const [selected, setSelected] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: FeedbackKind; text: string } | null>(null);
  const [newest, setNewest] = useState<string | null>(null);
  const [showHint, setShowHint] = useState(false);
  const [dlg, setDlg] = useState<'none' | 'reset' | 'reference' | 'done' | 'inspect' | 'challenge'>('none');
  const [answer, setAnswer] = useState<number | null>(null);
  const [ghost, setGhost] = useState<{ id: string; x: number; y: number } | null>(null);
  const drag = useRef<{ id: string; sx: number; sy: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const doneTimer = useRef<number | null>(null);

  const active = useMemo(() => (demo.on ? demoProgress(lesson, demo.count, lang) : progress), [demo, lang, progress]);
  const step = lesson.steps[active.placed.length] as LessonStep | undefined;
  const complete = isComplete(lesson, active);
  const n = active.placed.length;
  const total = lesson.steps.length;

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Any change to the build stops the motor (engine also clears `tested`).
  useEffect(() => {
    motorStopRef.current(); setShowHint(false); setSelected(null); endPreview();
    if (doneTimer.current) window.clearTimeout(doneTimer.current);
    doneTimer.current = null;
    setDlg(current => current === 'done' ? 'none' : current);
  }, [n, demo.on]);
  useEffect(() => () => {
    if (doneTimer.current) window.clearTimeout(doneTimer.current);
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
  }, []);

  // Narration never autoplays and is cancelled whenever its context changes.
  const narrStopRef = useRef(narration.stop); narrStopRef.current = narration.stop;
  useEffect(() => { narrStopRef.current(); }, [step?.id, lang, demo.on, dlg, presenting]);

  const motion: Motion = running || motor.angle !== 0
    ? transmissionMotion(motor.angle, tr.driverTeeth, tr.drivenTeeth, running && !motor.paused)
    : STILL;

  function endPreview() {
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = null;
    setPreview(null);
  }
  const showPreview = () => {
    if (!step) return;
    endPreview();
    setPreview(step.id); setPopKey((k) => k + 1);
    previewTimer.current = window.setTimeout(() => { setPreview(null); previewTimer.current = null; }, reduced ? 1600 : 2600);
  };
  const replayLast = () => {
    const last = active.placed[active.placed.length - 1];
    if (!last) return;
    endPreview(); setNewest(last); setPopKey((k) => k + 1);
  };

  const say = (kind: FeedbackKind, text: string) => setFeedback({ kind, text });

  const doPlace = useCallback((partSetId: string, targetId: string) => {
    if (demo.on) return;
    const r = placeSet(lesson, progress, partSetId, targetId);
    if (r.ok) {
      const placedId = r.progress.placed[r.progress.placed.length - 1];
      const s = lesson.steps.find((x) => x.id === placedId);
      setProgress(r.progress);
      setSelected(null);
      setShowHint(false);
      setNewest(placedId); setPopKey((k) => k + 1);
      say('ok', `${t.ok} ${s ? s.completion[lang] : ''}`);
    } else if (r.reason === 'wrong-set') say('warn', t.wrongSet);
    else if (r.reason === 'wrong-target') say('warn', t.wrongTarget);
    else say('info', t.allDone);
  }, [demo.on, progress, setProgress, t, lang]);

  const choose = (setId: string) => {
    if (demo.on) return;
    const s = lesson.steps.find((x) => x.partSetId === setId);
    if (!s || active.placed.includes(s.id)) return;
    if (selected === setId) { setSelected(null); return; }
    setSelected(setId);
    say('info', t.selectedMsg(s.title[lang]));
  };

  const onTarget = () => {
    if (!step) return;
    if (!selected) { say('info', t.pickFirst); return; }
    doPlace(selected, step.targetId);
  };
  const onMat = () => { if (selected) doPlace(selected, 'mat'); };

  // Mouse/pen drag; touch uses tap-to-place so the page can still scroll.
  const pDown = (e: RPointerEvent<HTMLButtonElement>, id: string) => {
    if (e.pointerType === 'touch' || demo.on || e.button !== 0) return;
    drag.current = { id, sx: e.clientX, sy: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const pMove = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 8) d.moved = true;
    if (d.moved) setGhost({ id: d.id, x: e.clientX, y: e.clientY });
  };
  const pUp = (e: RPointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    drag.current = null;
    setGhost(null);
    if (!d?.moved) return;
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 50);
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>('[data-drop]');
    if (el?.dataset.drop) { setSelected(d.id); doPlace(d.id, el.dataset.drop); }
    else say('warn', t.wrongTarget);
  };

  const runMotor = () => {
    if (running) {
      motor.stop();
      if (doneTimer.current) window.clearTimeout(doneTimer.current);
      doneTimer.current = null;
      return;
    }
    const r = testMotor(lesson, active);
    if (!r.ok) { say('warn', t.motorWait(r.remaining, step ? step.title[lang] : '')); return; }
    if (!demo.on) setProgress(r.progress);
    endPreview();
    motor.start();
    say('ok', t.doneBody);
    if (!demo.on) {
      if (doneTimer.current) window.clearTimeout(doneTimer.current);
      doneTimer.current = window.setTimeout(() => { setAnswer(null); setDlg('done'); }, reduced ? 600 : 2800);
    }
  };

  const setLang = (l: Language) => {
    setProgress((p) => ({ ...p, language: l }));
    setFeedback(null);
  };
  const narrText = step ? `${t.stepOf(step.number, total)}. ${step.title[lang]}. ${step.instruction[lang]}` : `${t.doneTitle} ${t.doneBody}`;
  const challengeOpen = demo.on ? complete : isComplete(lesson, progress) && progress.tested;
  const ratio = lesson.transmission.drivenTeeth / lesson.transmission.driverTeeth;
  const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
  const blades = (lesson.transmission.driverRpm * lesson.transmission.driverTeeth) / lesson.transmission.drivenTeeth;
  const trayCards = lesson.trayOrder.map((num) => lesson.steps[num - 1]);

  return (
    <div className="lab">
      <a href="#workspace" className="skip">{t.mat}</a>
      <header className="topbar">
        <FunAdemyWordmark sub={t.lab} />
        <div className="ye-chip">
          <img src={`${import.meta.env.BASE_URL}brand/ye-logo.svg`} alt={t.ye} className="ye-logo" />
          <span className="prog-label">{t.bc}</span>
        </div>
        <div className="top-actions">
          <button type="button" className={`btn btn-ghost ${demo.on ? 'is-on' : ''}`} aria-pressed={demo.on} data-testid="demo"
            onClick={() => { setDemo((d) => ({ on: !d.on, count: 0 })); setSelected(null); setFeedback(null); setShowHint(false); }}>
            <Presentation size={18} aria-hidden="true" />{demo.on ? t.demoOn : t.demo}
          </button>
          <button type="button" className="btn btn-ghost" data-testid="presentation-open" onClick={() => { motor.stop(); endPreview(); setPresenting(true); }}>
            <MonitorPlay size={18} aria-hidden="true" />{f.presOpen}
          </button>
          <button type="button" className="btn btn-ghost" data-testid="language" aria-label={t.langLabel} onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>
            <Languages size={18} aria-hidden="true" /><span lang={lang === 'ar' ? 'en' : 'ar'}>{t.langSwitch}</span>
          </button>
        </div>
      </header>
      <OfflineNotice lang={lang} />

      <section className="lesson-head" aria-labelledby="lesson-title">
        <div className="lh-main">
          <p className="eyebrow">{t.lessonCompanion} · <span className="mono">{lesson.code}</span> · {lesson.program[lang]} · {t.totalSteps}</p>
          <h1 id="lesson-title" className="display">{lesson.title[lang]}</h1>
          <p className="objective">{lesson.objective[lang]}</p>
        </div>
        <div className="lh-progress">
          <div className="prog-row">
            <span className="prog-count" data-testid="progress-count">{t.progress(n, total)}</span>
            {progress.tested && !demo.on && <span className="badge-ok" data-testid="status-tested"><Check size={14} aria-hidden="true" />{t.tested}</span>}
          </div>
          <div className="bar" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={n} aria-label={t.progressSr(n, total)} data-testid="progress">
            <span style={{ transform: `scaleX(${n / total})` }} />
          </div>
          <ol className="stages" aria-label={t.stageList}>
            {lesson.steps.map((s, i) => (
              <li key={s.id} className={i < n ? 'done' : i === n ? 'now' : ''} title={`${s.number}. ${s.title[lang]}`} data-testid={`stage-${s.number}`}>
                <span className="sr-only">{s.number}. {s.title[lang]} {i < n ? `(${t.installed})` : ''}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {notice !== 'none' && (
        <div className="notice" role="alert" data-testid="storage-notice">
          <span>{notice === 'blocked' ? t.storageFail : t.storageDiscarded}</span>
          {notice === 'discarded' && <button type="button" className="icon-btn" onClick={dismissNotice} aria-label={t.close}><X size={18} aria-hidden="true" /></button>}
        </div>
      )}

      <main id="workspace" className="workspace">
        {/* 1. Instructions */}
        <section className="panel panel-steps" aria-labelledby="step-h">
          {demo.on && (
            <div className="demo-box" data-testid="demo-panel">
              <p><Presentation size={16} aria-hidden="true" /> {t.demoBanner}</p>
              <div className="demo-row">
                <button type="button" className="btn btn-small" data-testid="demo-prev" disabled={demo.count === 0} onClick={() => setDemo((d) => ({ ...d, count: d.count - 1 }))}>
                  <ChevronLeft size={16} className="flip-rtl" aria-hidden="true" />{t.demoPrev}
                </button>
                <button type="button" className="btn btn-small" data-testid="demo-next" disabled={demo.count >= total} onClick={() => { setDemo((d) => ({ ...d, count: d.count + 1 })); setNewest(lesson.steps[demo.count]?.id ?? null); }}>
                  {t.demoNext}<ChevronRight size={16} className="flip-rtl" aria-hidden="true" />
                </button>
                <button type="button" className="btn btn-small" data-testid="demo-complete" disabled={demo.count >= total} onClick={() => setDemo((d) => ({ ...d, count: total }))}>{t.demoComplete}</button>
              </div>
            </div>
          )}
          {step ? (
            <>
              <p className="step-of" data-testid="step-number">{t.stepOf(step.number, total)} · <span className="muted">{t.guidePage(step.pdfPage)}</span></p>
              <h2 id="step-h" className="step-title" data-testid="step-title">{step.title[lang]}</h2>
              <p className="instruction">{step.instruction[lang]}</p>
              <NarrationControl status={narration.status} available={narration.available} onPlay={() => narration.play(narrText)} onStop={narration.stop} f={f} />
              <h3 className="mini-h">{t.piecesNeeded}</h3>
              <ul className="piece-list">
                {step.pieces.map((pc) => (
                  <li key={pc.name.en}><span className="qty mono">{pc.qty}×</span>{pc.name[lang]}</li>
                ))}
              </ul>
              <div className="note">
                <Cog size={18} aria-hidden="true" />
                <div><strong>{t.engineering}</strong><p>{step.engineeringNote[lang]}</p></div>
              </div>
              {showHint && (
                <div className="hint" role="status" data-testid="text-hint"><Lightbulb size={18} aria-hidden="true" /><p>{step.hint[lang]}</p></div>
              )}
            </>
          ) : (
            <>
              <p className="step-of">{t.complete}</p>
              <h2 id="step-h" className="step-title">{t.doneTitle}</h2>
              <p className="instruction">{demo.on ? t.doneBody : t.allDone}</p>
              <NarrationControl status={narration.status} available={narration.available} onPlay={() => narration.play(narrText)} onStop={narration.stop} f={f} />
            </>
          )}
          {demo.on && demo.count === 0 && <p className="muted small">{t.demoEmpty}</p>}
          <div className="tool-row">
            <button type="button" className="btn btn-soft" data-testid="hint" disabled={!step || demo.on} onClick={() => { setProgress(addHint(progress)); setShowHint(true); }}>
              <Lightbulb size={18} aria-hidden="true" />{t.hint}
            </button>
            <button type="button" className="btn btn-soft" data-testid="undo" disabled={demo.on || progress.placed.length === 0} onClick={() => { setProgress(undo(progress)); setNewest(null); say('info', t.undo); }}>
              <Undo2 size={18} aria-hidden="true" />{t.undo}
            </button>
            <button type="button" className="btn btn-soft" data-testid="reset" disabled={demo.on} onClick={() => setDlg('reset')}>
              <RotateCcw size={18} aria-hidden="true" />{t.reset}
            </button>
            <button type="button" className="btn btn-soft" data-testid="reference" onClick={() => setDlg('reference')}>
              <BookOpen size={18} aria-hidden="true" />{t.reference}
            </button>
          </div>
          <div className="tool-row preview-row">
            <button type="button" className="btn btn-soft" data-testid="button-step-preview" disabled={!step || running} onClick={preview ? endPreview : showPreview} aria-pressed={!!preview}>
              <Eye size={18} aria-hidden="true" />{preview ? f.stopPreview : f.preview}
            </button>
            <button type="button" className="btn btn-soft" data-testid="button-replay-last" disabled={n === 0 || running} onClick={replayLast}>
              <History size={18} aria-hidden="true" />{f.replayLast}
            </button>
          </div>
          {!demo.on && <p className="muted small" data-testid="hints-used">{t.hintsUsed(progress.hintsUsed)}</p>}
        </section>

        {/* 2. Build mat */}
        <section className="panel panel-mat" aria-labelledby="mat-h">
          <div className="mat-head">
            <h2 id="mat-h" className="mini-h">{t.mat}</h2>
            <button type="button" className="btn btn-small mat-inspect" data-testid="button-inspect" onClick={() => setDlg('inspect')}>
              <ScanSearch size={16} aria-hidden="true" />{f.inspect}
            </button>
            <span className={`motor-pill ${motion.motorOn ? 'on' : ''}`} data-testid="motor-status" role="status">
              <span className="dot" aria-hidden="true" />{motion.motorOn ? t.motorOn : t.motorOff}
            </span>
          </div>
          <div className="mat" dir="ltr" data-drop="mat" onClick={onMat} data-testid="build-mat" style={{ aspectRatio: `${VB.w} / ${VB.h}` }}>
            <svg viewBox={vbStr} role="img" aria-label={`${t.matSr} ${t.progressSr(n, total)}`}>
              <ArrowDefs />
              <WindmillModel lesson={lesson} placed={active.placed} motion={motion} newest={newest} popKey={popKey} preview={preview} direction={motor.direction} />
            </svg>
            {preview && <p className="preview-badge" role="status" data-testid="status-preview">{f.previewing}</p>}
            {step && !demo.on && !preview && (
              <button
                type="button" className={`target ${selected === step.partSetId ? 'armed' : ''}`} data-drop={step.targetId} data-testid="placement-target"
                aria-label={t.placeHere(step.title[lang])}
                style={{ left: pct(step.target.x, VB.x, VB.w), top: pct(step.target.y, VB.y, VB.h), width: `${(step.target.w / VB.w) * 100}%`, height: `${(step.target.h / VB.h) * 100}%` }}
                onClick={(e) => { e.stopPropagation(); onTarget(); }}
              >
                <span className="target-num mono">{step.number}</span>
              </button>
            )}
          </div>
          <div className="feedback" role="status" aria-live="polite" data-testid="feedback">
            {feedback && <p className={`fb fb-${feedback.kind}`}>{feedback.text}</p>}
          </div>
          <div className="motor-row">
            <button type="button" className={`btn btn-motor ${complete ? 'ready' : ''}`} data-testid="run-motor" onClick={runMotor} aria-pressed={running}>
              {running ? <Square size={18} aria-hidden="true" /> : complete ? <Play size={18} aria-hidden="true" /> : <Lock size={18} aria-hidden="true" />}
              {running ? t.stopMotor : t.runMotor}
            </button>
            <div className="ratio" data-testid="gear-ratio">
              <strong>{t.ratioTitle} <span className="mono">{lesson.transmission.driverTeeth}:{lesson.transmission.drivenTeeth}</span></strong>
              <span>{t.ratioLine(lesson.transmission.driverTeeth, lesson.transmission.drivenTeeth)} · {t.opposite}</span>
              <span>{t.ratioTurns(fmt(ratio))} <span className="mono">{t.rpm(fmt(lesson.transmission.driverRpm), fmt(blades))}</span></span>
              <em>{lesson.transmissionNote[lang]}</em>
            </div>
          </div>
          <MotorControls m={motor} enabled={complete} rpm={tr.driverRpm} driverTeeth={tr.driverTeeth} drivenTeeth={tr.drivenTeeth} reduced={reduced} f={f} />
          <div className="ch-launch">
            <button type="button" className="btn btn-soft" data-testid="button-challenges" disabled={!challengeOpen} onClick={() => { motor.stop(); setDlg('challenge'); }}>
              <FlaskConical size={18} aria-hidden="true" />{f.chOpen}
            </button>
            {!challengeOpen && <span className="muted small" data-testid="text-challenges-locked">{f.chLocked}</span>}
          </div>
        </section>

        {/* 3. Parts tray */}
        <section className="panel panel-tray" aria-labelledby="tray-h">
          <h2 id="tray-h" className="mini-h">{t.tray}</h2>
          <p className="muted small">{t.trayHelp}</p>
          <ul className="tray">
            {trayCards.map((s) => {
              const done = active.placed.includes(s.id);
              const isNext = step?.id === s.id;
              const isSel = selected === s.partSetId;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    className={`card ${done ? 'done' : ''} ${isNext && !demo.on ? 'next' : ''} ${isSel ? 'sel' : ''}`}
                    data-testid={`part-set-${s.number}`}
                    aria-pressed={isSel}
                    disabled={done || demo.on}
                    onPointerDown={(e) => pDown(e, s.partSetId)} onPointerMove={pMove} onPointerUp={pUp}
                    onPointerCancel={() => { drag.current = null; setGhost(null); }}
                    onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } choose(s.partSetId); }}
                  >
                    <PartThumb step={s} />
                    <span className="card-title">{s.title[lang]}</span>
                    <span className="card-pieces">{s.pieces.map((pc) => `${pc.qty}× ${pc.name[lang]}`).join(' · ')}</span>
                    <span className="card-tag">
                      {done ? <><Check size={13} aria-hidden="true" />{t.installed}</> : isSel ? t.selected : isNext && !demo.on ? t.nextSet : `${s.pieces.reduce((a, b) => a + b.qty, 0)} ${t.pieces}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      </main>

      <footer className="foot">
        <p className="small">{t.privacy}</p>
        <p className="small">{t.companion}</p>
        <p className="foot-credit" data-testid="footer-credit">{t.footer}</p>
      </footer>

      {ghost && (() => {
        const s = lesson.steps.find((x) => x.partSetId === ghost.id);
        return s ? <div className="ghost" style={{ transform: `translate(${ghost.x - 50}px, ${ghost.y - 40}px)` }} aria-hidden="true"><PartThumb step={s} /></div> : null;
      })()}

      <Dialog open={dlg === 'reset'} onClose={() => setDlg('none')} title={t.resetTitle} closeLabel={t.close} testId="dialog-reset">
        <p className="dlg-body">{t.resetBody}</p>
        <div className="dlg-actions">
          <button type="button" className="btn btn-soft" data-autofocus onClick={() => setDlg('none')} data-testid="reset-cancel">{t.cancel}</button>
          <button type="button" className="btn btn-danger" data-testid="reset-confirm"
            onClick={() => { setProgress(reset(lesson, progress)); setSelected(null); setNewest(null); setShowHint(false); setFeedback(null); setDlg('none'); }}>
            {t.resetConfirm}
          </button>
        </div>
      </Dialog>

      <Dialog open={dlg === 'reference'} onClose={() => setDlg('none')} title={t.referenceTitle} closeLabel={t.close} testId="dialog-reference" wide>
        <p className="dlg-body">{t.referenceBody}</p>
        <div className="ref-mat" dir="ltr">
          <svg viewBox={vbStr} role="img" aria-label={t.modelAlt}>
            <WindmillModel lesson={lesson} placed={lesson.steps.map((s) => s.id)} motion={STILL} />
          </svg>
        </div>
        <ol className="ref-list">
          {lesson.steps.map((s) => <li key={s.id}><span className="mono">{s.number}</span> {s.title[lang]}</li>)}
        </ol>
      </Dialog>

      <Dialog open={dlg === 'done'} onClose={() => setDlg('none')} title={t.doneTitle} closeLabel={t.close} testId="dialog-complete">
        <p className="dlg-body">{t.doneBody}</p>
        <fieldset className="quiz">
          <legend>{t.question}</legend>
          {t.answers.map((a, i) => (
            <button key={a} type="button" className={`quiz-opt ${answer === i ? (i === 0 ? 'right' : 'wrong') : ''}`} aria-pressed={answer === i} data-testid={`reflection-option-${i + 1}`} onClick={() => setAnswer(i)}>
              <span className="mono">{i + 1}</span>{a}
            </button>
          ))}
          <p role="status" className={`quiz-fb ${answer === 0 ? 'fb-ok' : 'fb-warn'}`} data-testid="reflection-feedback">
            {answer === null ? '' : answer === 0 ? t.correct : t.tryAgain}
          </p>
        </fieldset>
        <div className="dlg-actions">
          <button type="button" className="btn btn-soft" onClick={() => setDlg('none')}>{t.close}</button>
          <button type="button" className="btn btn-motor ready" data-testid="replay" onClick={() => { setDlg('none'); motor.stop(); requestAnimationFrame(() => motor.start()); }}>
            <Play size={18} aria-hidden="true" />{t.replay}
          </button>
        </div>
      </Dialog>
      <InspectDialog open={dlg === 'inspect'} onClose={() => setDlg('none')} lesson={lesson} placed={active.placed} motion={motion} direction={motor.direction} f={f} closeLabel={t.close} />
      <ChallengeDialog open={dlg === 'challenge'} onClose={() => setDlg('none')} f={f} closeLabel={t.close} rpm={tr.driverRpm} reduced={reduced} buildDriver={tr.driverTeeth} buildDriven={tr.drivenTeeth} />
      {presenting && <PresentationMode lesson={lesson} lang={lang} f={f} t={t} startAt={0} onExit={() => setPresenting(false)} />}
    </div>
  );
}
