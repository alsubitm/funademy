import { useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize2, ZoomIn, ZoomOut } from 'lucide-react';
import type { FxStrings } from '@/i18n/features';

const MIN = 1, MAX = 4, STEP = 0.5, PAN = 10;

/** Zoom/pan viewport. Translation (in % of the pane) is clamped so content never leaves the frame. */
export function ZoomPane({ children, f, label }: { children: ReactNode; f: FxStrings; label: string }) {
  const [z, setZ] = useState({ s: 1, x: 0, y: 0 });
  const pane = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; px: number; py: number; x: number; y: number } | null>(null);
  const clamp = (s: number, x: number, y: number) => {
    const lim = ((s - 1) / 2) * 100;
    return { s, x: Math.max(-lim, Math.min(lim, x)), y: Math.max(-lim, Math.min(lim, y)) };
  };
  const zoom = (d: number) => setZ((o) => { const s = Math.max(MIN, Math.min(MAX, o.s + d)); return clamp(s, o.x, o.y); });
  const pan = (dx: number, dy: number) => setZ((o) => clamp(o.s, o.x + dx, o.y + dy));
  const reset = () => setZ({ s: 1, x: 0, y: 0 });

  const onKey = (e: KeyboardEvent) => {
    const map: Record<string, () => void> = {
      '+': () => zoom(STEP), '=': () => zoom(STEP), '-': () => zoom(-STEP), '0': reset,
      ArrowUp: () => pan(0, PAN), ArrowDown: () => pan(0, -PAN), ArrowLeft: () => pan(PAN, 0), ArrowRight: () => pan(-PAN, 0),
    };
    const fn = map[e.key];
    if (fn) { e.preventDefault(); fn(); }
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    if (z.s === 1) return;
    drag.current = { id: e.pointerId, px: e.clientX, py: e.clientY, x: z.x, y: z.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current; const el = pane.current;
    if (!d || !el || d.id !== e.pointerId) return;
    const r = el.getBoundingClientRect();
    setZ((o) => clamp(o.s, d.x + ((e.clientX - d.px) / r.width) * 100, d.y + ((e.clientY - d.py) / r.height) * 100));
  };
  const up = () => { drag.current = null; };

  return (
    <div className="zoom">
      <div className="zoom-bar" role="toolbar" aria-label={label} dir="ltr">
        <button type="button" className="icon-btn" onClick={() => zoom(-STEP)} disabled={z.s <= MIN} aria-label={f.zoomOut} data-testid="inspect-zoom-out"><ZoomOut size={18} aria-hidden="true" /></button>
        <span className="mono zoom-level" data-testid="inspect-zoom-level" aria-live="polite">{f.zoomLevel(Math.round(z.s * 100))}</span>
        <button type="button" className="icon-btn" onClick={() => zoom(STEP)} disabled={z.s >= MAX} aria-label={f.zoomIn} data-testid="inspect-zoom-in"><ZoomIn size={18} aria-hidden="true" /></button>
        <span className="zoom-sep" aria-hidden="true" />
        <button type="button" className="icon-btn" onClick={() => pan(PAN, 0)} disabled={z.s === 1} aria-label={f.pan.left} data-testid="inspect-pan-left"><ArrowLeft size={18} aria-hidden="true" /></button>
        <button type="button" className="icon-btn" onClick={() => pan(0, PAN)} disabled={z.s === 1} aria-label={f.pan.up} data-testid="inspect-pan-up"><ArrowUp size={18} aria-hidden="true" /></button>
        <button type="button" className="icon-btn" onClick={() => pan(0, -PAN)} disabled={z.s === 1} aria-label={f.pan.down} data-testid="inspect-pan-down"><ArrowDown size={18} aria-hidden="true" /></button>
        <button type="button" className="icon-btn" onClick={() => pan(-PAN, 0)} disabled={z.s === 1} aria-label={f.pan.right} data-testid="inspect-pan-right"><ArrowRight size={18} aria-hidden="true" /></button>
        <button type="button" className="btn btn-small" onClick={reset} data-testid="inspect-zoom-reset"><Maximize2 size={16} aria-hidden="true" />{f.zoomReset}</button>
      </div>
      <div ref={pane} className={`zoom-pane ${z.s > 1 ? 'can-pan' : ''}`} tabIndex={0} onKeyDown={onKey} aria-label={`${label}. ${f.panHelp}`} role="group"
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} data-testid="inspect-viewport">
        <div className="zoom-inner" style={{ transform: `translate(${z.x}%, ${z.y}%) scale(${z.s})` }}>{children}</div>
      </div>
      <p className="muted small">{f.panHelp}</p>
    </div>
  );
}
