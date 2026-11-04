import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FlaskConical, Play, RotateCcw } from 'lucide-react';
import { Dialog } from '@/components/Dialog';
import { Gear } from '@/components/parts/Bricks';
import { advanceDriverAngle, transmissionMotion } from '@/lib/motor-controls';
import { REDUCED_FACTOR } from '@/hooks/use-motor';
import type { FxStrings } from '@/i18n/features';

const fmt = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function GearSim({ driverTeeth, drivenTeeth, direction, running, rpm, reduced, label }: {
  driverTeeth: number; drivenTeeth: number; direction: 1 | -1; running: boolean; rpm: number; reduced: boolean; label: string;
}) {
  const [angle, setAngle] = useState(0);
  const aRef = useRef(0);
  useEffect(() => { aRef.current = 0; setAngle(0); }, [driverTeeth, drivenTeeth, direction]);
  useEffect(() => {
    if (!running) return;
    let raf = 0; let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      aRef.current = advanceDriverAngle(aRef.current, Math.max(0, dt), rpm, reduced ? REDUCED_FACTOR : 1, direction) % (360 * 36);
      setAngle(aRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, rpm, reduced, direction]);
  const m = transmissionMotion(angle, driverTeeth, drivenTeeth, running);
  // Radius proportional to tooth count (same tooth size), so the drawing matches the ratio.
  const k = 3.2;
  const r1 = driverTeeth * k, r2 = drivenTeeth * k;
  const cx1 = 30 + r1 + 10, cx2 = cx1 + r1 + r2 - 5, cy = 130;
  return (
    <svg viewBox={`0 0 ${cx2 + r2 + 40} 260`} className="ch-sim" role="img" aria-label={`${label}: ${driverTeeth}:${drivenTeeth}`} data-testid="challenge-sim">
      <Gear cx={cx1} cy={cy} r={r1} teeth={driverTeeth} angle={m.driver} tone="blue" />
      <Gear cx={cx2} cy={cy} r={r2} teeth={drivenTeeth} angle={m.driven + 180 / drivenTeeth} />
      <text x={cx1} y={250} textAnchor="middle" fontSize={14} fontWeight={700} fill="#102047" fontFamily="Space Mono, monospace">IN {driverTeeth}T</text>
      <text x={cx2} y={250} textAnchor="middle" fontSize={14} fontWeight={700} fill="#102047" fontFamily="Space Mono, monospace">OUT {drivenTeeth}T</text>
    </svg>
  );
}

export function ChallengeDialog({ open, onClose, f, closeLabel, rpm, reduced, buildDriven, buildDriver }: {
  open: boolean; onClose: () => void; f: FxStrings; closeLabel: string; rpm: number; reduced: boolean; buildDriver: number; buildDriven: number;
}) {
  const items = f.items;
  const [idx, setIdx] = useState(0);
  const [pick, setPick] = useState<Record<string, number | null>>({});
  const [tested, setTested] = useState<Record<string, boolean>>({});
  const [msg, setMsg] = useState('');
  useEffect(() => { if (!open) setMsg(''); }, [open]);
  const it = items[idx];
  const chosen = pick[it.id] ?? null;
  const done = !!tested[it.id];
  const outRpm = (rpm * it.driverTeeth) / it.drivenTeeth;
  // Build direction: forward motor, driven turns opposite. Same as build iff challenge direction is forward.
  const sameDir = it.direction === 1;
  void buildDriver; void buildDriven;

  const redo = () => { setPick((p) => ({ ...p, [it.id]: null })); setTested((t) => ({ ...t, [it.id]: false })); setMsg(''); };
  const resetAll = () => { setPick({}); setTested({}); setIdx(0); setMsg(''); };

  return (
    <Dialog open={open} onClose={onClose} title={f.chTitle} closeLabel={closeLabel} testId="dialog-challenges" wide>
      <p className="schem-tag" data-testid="challenge-disclaimer"><FlaskConical size={16} aria-hidden="true" /> {f.chDisclaimer}</p>
      <div className="seg" role="tablist" aria-label={f.chTitle}>
        {items.map((c, i) => (
          <button key={c.id} type="button" role="tab" aria-selected={i === idx} className={`seg-btn ${i === idx ? 'on' : ''}`} data-testid={`challenge-tab-${c.id}`} onClick={() => { setIdx(i); setMsg(''); }}>
            <span className="mono">{i + 1}</span> {c.title}
          </button>
        ))}
      </div>
      <div className="ch-body">
        <div>
          <p className="step-of">{f.chOf(idx + 1, items.length)}</p>
          <h3 className="mini-h ch-title" data-testid="challenge-title">{it.title}</h3>
          <p className="dlg-body">{it.setup}</p>
          <fieldset className="quiz">
            <legend>{f.chPredict}: {it.question}</legend>
            {it.options.map((o, i) => (
              <button key={o} type="button" disabled={done} aria-pressed={chosen === i}
                className={`quiz-opt ${chosen === i ? (done ? (i === it.correct ? 'right' : 'wrong') : 'picked') : done && i === it.correct ? 'right' : ''}`}
                data-testid={`challenge-option-${i + 1}`} onClick={() => { setPick((p) => ({ ...p, [it.id]: i })); setMsg(''); }}>
                <span className="mono">{i + 1}</span>{o}
              </button>
            ))}
          </fieldset>
          <div className="dlg-actions ch-actions">
            {!done ? (
              <button type="button" className="btn btn-motor ready" data-testid="challenge-test" onClick={() => { if (chosen === null) { setMsg(f.chNeedPick); return; } setTested((t) => ({ ...t, [it.id]: true })); setMsg(''); }}>
                <Play size={18} aria-hidden="true" />{f.chTest}
              </button>
            ) : (
              <button type="button" className="btn btn-soft" data-testid="challenge-redo" onClick={redo}><RotateCcw size={16} aria-hidden="true" />{f.chRedo}</button>
            )}
            {done && idx < items.length - 1 && (
              <button type="button" className="btn btn-soft" data-testid="challenge-next" onClick={() => { setIdx(idx + 1); setMsg(''); }}>{f.chNext}<ChevronRight size={16} className="flip-rtl" aria-hidden="true" /></button>
            )}
            <button type="button" className="btn btn-ghost" data-testid="challenge-reset" onClick={resetAll}>{f.chReset}</button>
          </div>
          <div role="status" aria-live="polite" data-testid="challenge-feedback">
            {msg && <p className="fb fb-info">{msg}</p>}
            {done && (
              <div className={`fb ${chosen === it.correct ? 'fb-ok' : 'fb-warn'}`}>
                <strong>{chosen === it.correct ? f.chRight : f.chWrong}</strong>
                <p className="ch-explain">{it.explain}</p>
              </div>
            )}
          </div>
        </div>
        <div className="ch-stage">
          <GearSim driverTeeth={it.driverTeeth} drivenTeeth={it.drivenTeeth} direction={it.direction} running={open && done} rpm={rpm} reduced={reduced} label={f.chSimSr} />
          <ul className="ch-read" data-testid="challenge-readout">
            <li className="mono">{f.chRatio(it.driverTeeth, it.drivenTeeth)}</li>
            {done && <li className="mono">{f.chOut(fmt(rpm), fmt(outRpm))}</li>}
            {done && <li>{f.chDir(sameDir)}</li>}
            {reduced && <li className="small">{f.reducedNote}</li>}
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
