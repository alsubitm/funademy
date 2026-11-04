'use client';

import type { KeyboardEvent } from 'react';
import type { Direction } from '@/lib/lab/engine';
import { getSlot } from '@/lib/lab/engine';
import type { Lesson, Placements } from '@/lib/lab/types';

export const C = {
  base: '#11388E', baseTop: '#1C54CB', support: '#E5AE4A', supportDark: '#B9822A',
  axle: '#2B3245', gearA: '#FFCA17', gearAEdge: '#C99400', gearB: '#1C54CB', gearBEdge: '#0E2F7A',
  crank: '#D3591B', rotor: '#22B8DA', ink: '#101A38',
};

export function gearPath(r: number, teeth: number): string {
  const outer = r + 6, root = r - 6, n = teeth * 4;
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 4 === 0 || i % 4 === 1 ? outer : root;
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

function Gear({ r, teeth, fill, edge }: { r: number; teeth: number; fill: string; edge: string }) {
  return (
    <g>
      <path d={gearPath(r, teeth)} fill={fill} stroke={edge} strokeWidth={2.5} strokeLinejoin="round" />
      <circle r={r - 14} fill="none" stroke={edge} strokeWidth={2} opacity={0.55} />
      {[0, 120, 240].map((a) => <circle key={a} r={5} cx={(Math.cos((a * Math.PI) / 180) * (r - 24)).toFixed(3)} cy={(Math.sin((a * Math.PI) / 180) * (r - 24)).toFixed(3)} fill={edge} opacity={0.45} />)}
      <line x1={0} y1={-(r - 8)} x2={0} y2={-(r - 18)} stroke={C.ink} strokeWidth={3} strokeLinecap="round" />
      <circle r={9} fill="#F7EFDD" stroke={edge} strokeWidth={2.5} />
    </g>
  );
}

function Crank() {
  return (
    <g>
      <rect x={-6} y={-6} width={44} height={12} rx={6} fill={C.crank} stroke="#8E3510" strokeWidth={2} />
      <circle cx={38} cy={0} r={10} fill="#F7EFDD" stroke="#8E3510" strokeWidth={2.5} />
      <circle cx={38} cy={0} r={4} fill="#8E3510" />
      <circle r={9} fill={C.crank} stroke="#8E3510" strokeWidth={2.5} />
    </g>
  );
}

function Rotor() {
  return (
    <g>
      {[0, 120, 240].map((a) => (
        <path key={a} transform={`rotate(${a})`} d="M0,-6 C18,-14 50,-16 62,-4 C52,8 20,10 0,6 Z" fill={C.rotor} fillOpacity={0.72} stroke="#0B6E86" strokeWidth={2} />
      ))}
      <circle r={11} fill="#F7EFDD" stroke="#0B6E86" strokeWidth={2.5} />
    </g>
  );
}

function AxleEnd() {
  return (
    <g>
      <circle r={8} fill={C.axle} />
      <path d="M-4,0H4M0,-4V4" stroke="#9AA6C8" strokeWidth={2} strokeLinecap="round" />
    </g>
  );
}

/** Small tray illustration of a part in a given orientation. */
export function PartArt({ partId, orientation, size = 64 }: { partId: string; orientation: string; size?: number }) {
  let body = null;
  switch (partId) {
    case 'base':
      body = <g><rect x={-44} y={-10} width={88} height={20} rx={4} fill={C.base} />{[-30, -10, 10, 30].map((x) => <circle key={x} cx={x} cy={-10} r={4} fill={C.baseTop} />)}</g>;
      break;
    case 'support':
      body = <g transform={`rotate(${orientation === 'side' ? 90 : 0})`}><rect x={-9} y={-38} width={18} height={76} rx={4} fill={C.support} stroke={C.supportDark} strokeWidth={2} /><circle cy={-26} r={6} fill="#F7EFDD" stroke={C.supportDark} strokeWidth={2} /></g>;
      break;
    case 'axle':
      body = orientation === 'through'
        ? <g><circle r={16} fill="none" stroke="#9AA6C8" strokeDasharray="3 4" /><g transform="scale(1.8)"><AxleEnd /></g></g>
        : <g><rect x={-40} y={-5} width={80} height={10} rx={5} fill={C.axle} /><rect x={30} y={-7} width={8} height={14} rx={2} fill="#4A5578" /></g>;
      break;
    case 'gear':
      body = <g transform="scale(0.7)"><Gear r={40} teeth={12} fill={C.gearA} edge={C.gearAEdge} /></g>;
      break;
    case 'crank':
      body = <g transform={`rotate(${orientation === 'in' ? 180 : 0}) translate(-18,0)`} opacity={orientation === 'in' ? 0.75 : 1}><Crank /></g>;
      break;
    case 'rotor':
      body = orientation === 'front'
        ? <g transform="scale(0.62)"><Rotor /></g>
        : <g><rect x={-40} y={-4} width={80} height={8} rx={4} fill={C.rotor} stroke="#0B6E86" strokeWidth={2} /><circle r={7} fill="#F7EFDD" stroke="#0B6E86" strokeWidth={2} /></g>;
      break;
  }
  return (
    <svg viewBox="-50 -50 100 100" width={size} height={size} aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}

function DirArrow({ dir }: { dir: Direction }) {
  // arc above the axis with arrowhead showing direction
  const d = dir === 1 ? 'M-30,-52 A60,60 0 0 1 30,-52' : 'M30,-52 A60,60 0 0 0 -30,-52';
  const tip = dir === 1 ? { x: 30, y: -52, r: 30 } : { x: -30, y: -52, r: 150 };
  return (
    <g className="lab-dir" pointerEvents="none">
      <path d={d} fill="none" stroke={C.ink} strokeWidth={3.5} strokeLinecap="round" strokeDasharray="2 7" />
      <path d="M-7,-6 L5,0 L-7,6 Z" fill={C.ink} transform={`translate(${tip.x},${tip.y}) rotate(${tip.r})`} />
    </g>
  );
}

export interface WorkbenchProps {
  lesson: Lesson;
  placements: Placements;
  theta: number;
  moving: Record<string, Direction> | null;
  axesTurning: Record<string, Direction> | null;
  selectedPart: string | null;
  selectedSlot: string | null;
  hintSlot: string | null;
  flash: { slot: string; tone: 'ok' | 'err' } | null;
  interactive: boolean;
  slotLabel: (slotId: string) => string;
  onSlot?: (slotId: string) => void;
  onPlaced?: (slotId: string) => void;
}

export function Workbench(p: WorkbenchProps) {
  const { lesson, placements, theta, moving } = p;
  const W = lesson.workbench;
  const filled = (prefix: string) => lesson.slots.filter((s) => s.id.startsWith(prefix) && placements[s.id]);
  const axisOf = (slotId: string) => lesson.axes.find((a) => a.id === getSlot(lesson, slotId)?.axis);
  const key = (fn?: (id: string) => void, id?: string) => (e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && fn && id) { e.preventDefault(); fn(id); }
  };
  const placedProps = (slotId: string, label: string) => p.interactive ? {
    role: 'button', tabIndex: 0, 'aria-label': label, 'data-placed': slotId, 'data-testid': `placed-${slotId}`,
    onClick: () => p.onPlaced?.(slotId), onKeyDown: key(p.onPlaced, slotId),
    className: `lab-placed${p.selectedSlot === slotId ? ' is-selected' : ''}${p.flash?.slot === slotId ? ` flash-${p.flash.tone}` : ''}`,
  } : { 'data-testid': `placed-${slotId}`, className: 'lab-placed' };
  const ang = (slotId: string, phase = 0) => (moving?.[slotId] ? moving[slotId] * theta + phase : phase);

  return (
    <svg className="lab-svg" viewBox={`0 0 ${W.width} ${W.height}`} role="group" aria-label="workbench" data-testid="svg-workbench" direction="ltr">
      <defs>
        <pattern id="lab-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M20 0H0V20" fill="none" stroke="#1C54CB" strokeOpacity="0.09" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width={W.width} height={W.height} fill="url(#lab-grid)" />
      <line x1={10} y1={268} x2={W.width - 10} y2={268} stroke="#D6C6A0" strokeWidth={2} />

      {placements.base && (
        <g {...placedProps('base', slotLabelSafe(p, 'base'))}>
          <rect x={20} y={240} width={320} height={26} rx={6} fill={C.base} />
          {Array.from({ length: 15 }, (_, i) => <rect key={i} x={30 + i * 21} y={234} width={12} height={7} rx={2} fill={C.baseTop} />)}
        </g>
      )}

      {filled('support-').map((s) => {
        const ax = axisOf(`axle-${s.id.split('-')[1]}`)!;
        return (
          <g key={s.id} {...placedProps(s.id, slotLabelSafe(p, s.id))}>
            <rect x={ax.x - 11} y={ax.y - 18} width={22} height={240 - ax.y + 18} rx={5} fill={C.support} stroke={C.supportDark} strokeWidth={2} />
            <circle cx={ax.x} cy={ax.y} r={9} fill="#F7EFDD" stroke={C.supportDark} strokeWidth={2} />
          </g>
        );
      })}

      {filled('gear-').map((s) => {
        const ax = axisOf(s.id)!;
        const lead = s.axis === lesson.axes[0].id;
        return (
          <g key={s.id} {...placedProps(s.id, slotLabelSafe(p, s.id))}>
            <g transform={`translate(${ax.x} ${ax.y}) rotate(${ang(s.id, lead ? 0 : 15)})`}>
              <Gear r={40} teeth={12} fill={lead ? C.gearA : C.gearB} edge={lead ? C.gearAEdge : C.gearBEdge} />
            </g>
          </g>
        );
      })}

      {filled('axle-').map((s) => {
        const ax = axisOf(s.id)!;
        return <g key={s.id} {...placedProps(s.id, slotLabelSafe(p, s.id))}><g transform={`translate(${ax.x} ${ax.y}) rotate(${ang(s.id)})`}><AxleEnd /></g></g>;
      })}

      {filled('rotor-').map((s) => {
        const ax = axisOf(s.id)!;
        return <g key={s.id} {...placedProps(s.id, slotLabelSafe(p, s.id))}><g transform={`translate(${ax.x} ${ax.y}) rotate(${ang(s.id)})`}><Rotor /></g></g>;
      })}

      {filled('crank-').map((s) => {
        const ax = axisOf(s.id)!;
        return <g key={s.id} {...placedProps(s.id, slotLabelSafe(p, s.id))}><g transform={`translate(${ax.x} ${ax.y}) rotate(${ang(s.id, 120)})`}><Crank /></g></g>;
      })}

      {p.axesTurning && Object.entries(p.axesTurning).map(([id, dir]) => {
        const ax = lesson.axes.find((a) => a.id === id);
        return ax ? <g key={id} transform={`translate(${ax.x} ${ax.y})`} data-testid={`dir-${id}-${dir === 1 ? 'cw' : 'ccw'}`}><DirArrow dir={dir} /></g> : null;
      })}

      {p.interactive && lesson.slots.filter((s) => !placements[s.id]).map((s) => {
        const compatible = p.selectedPart === s.accepts;
        const ready = s.requires.every((r) => placements[r]);
        const hinted = p.hintSlot === s.id;
        const cls = ['lab-slot', compatible ? 'is-compatible' : '', compatible && ready ? 'is-ready' : '', hinted ? 'is-hint' : '', p.flash?.slot === s.id ? `flash-${p.flash.tone}` : ''].join(' ');
        if (!p.selectedPart && !hinted) return null;
        if (s.id === 'base') {
          return (
            <g key={s.id} className={cls} data-slot={s.id} data-testid={`slot-${s.id}`} role="button" tabIndex={0} aria-label={p.slotLabel(s.id)} onClick={() => p.onSlot?.(s.id)} onKeyDown={key(p.onSlot, s.id)}>
              <rect x={20} y={236} width={320} height={30} rx={6} className="lab-slot-ring" />
            </g>
          );
        }
        return (
          <g key={s.id} className={cls} data-slot={s.id} data-testid={`slot-${s.id}`} role="button" tabIndex={0} aria-label={p.slotLabel(s.id)} onClick={() => p.onSlot?.(s.id)} onKeyDown={key(p.onSlot, s.id)}>
            <circle cx={s.x} cy={s.y} r={17} fill="transparent" />
            <circle cx={s.x} cy={s.y} r={11} className="lab-slot-ring" />
            <circle cx={s.x} cy={s.y} r={3.5} className="lab-slot-dot" />
          </g>
        );
      })}
    </svg>
  );
}

function slotLabelSafe(p: WorkbenchProps, id: string) {
  return p.slotLabel(id);
}
