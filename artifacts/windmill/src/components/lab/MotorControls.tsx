import { Pause, Play, Repeat, Snail } from 'lucide-react';
import type { MotorState } from '@/hooks/use-motor';
import type { FxStrings } from '@/i18n/features';

const fmt = (v: number) => (Math.abs(v) < 10 ? v.toFixed(1) : v.toFixed(0));

export function MotorControls({ m, enabled, rpm, driverTeeth, drivenTeeth, reduced, f }: {
  m: MotorState; enabled: boolean; rpm: number; driverTeeth: number; drivenTeeth: number; reduced: boolean; f: FxStrings;
}) {
  const fwd = m.direction === 1;
  const live = m.running && !m.paused ? rpm * m.factor : 0;
  return (
    <div className="mc" data-testid="motor-controls">
      {!enabled && <p className="muted small" data-testid="motor-controls-locked">{f.locked}</p>}
      <div className="mc-row">
        <label className="mc-speed">
          <span>{f.speed} <span className="mono" data-testid="text-motor-speed">{f.speedVal(m.speed.toFixed(2))}</span></span>
          <input type="range" min={0.25} max={2} step={0.05} value={m.speed} disabled={!enabled}
            onChange={(e) => m.setSpeed(Number(e.target.value))} data-testid="input-motor-speed" aria-valuetext={f.speedVal(m.speed.toFixed(2))} />
        </label>
        <button type="button" className="btn btn-small" disabled={!enabled} onClick={m.reverse} aria-pressed={!fwd} data-testid="button-motor-reverse">
          <Repeat size={16} aria-hidden="true" />{f.reverse}
        </button>
        <button type="button" className="btn btn-small" disabled={!enabled || !m.running} onClick={m.togglePause} aria-pressed={m.paused} data-testid="button-motor-pause">
          {m.paused ? <Play size={16} aria-hidden="true" /> : <Pause size={16} aria-hidden="true" />}{m.paused ? f.resume : f.pause}
        </button>
        <button type="button" className={`btn btn-small ${m.slow ? 'is-on' : ''}`} disabled={!enabled} onClick={() => m.setSlow(!m.slow)} aria-pressed={m.slow} data-testid="button-motor-slow">
          <Snail size={16} aria-hidden="true" />{f.slow}
        </button>
      </div>
      <div className="mc-read" role="status" data-testid="motor-readout">
        <span data-testid="text-motor-direction">{f.dirMotor(fwd)} · {f.dirBlades(fwd)}</span>
        <span className="mono" data-testid="text-motor-live">{m.paused ? f.paused : f.live(fmt(live), fmt((live * driverTeeth) / drivenTeeth))}</span>
        {m.slow && <span className="small">{f.slowNote}</span>}
        {reduced && <span className="small" data-testid="text-reduced-motion">{f.reducedNote}</span>}
      </div>
    </div>
  );
}
