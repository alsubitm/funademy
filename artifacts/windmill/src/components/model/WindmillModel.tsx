import type { ReactNode } from 'react';
import { Axle, Blade, Brick, C, CrossEnd, Gear, Motor, Slope } from '@/components/parts/Bricks';
import type { Lesson } from '@/data/lessons/windmill';

export interface Motion { driver: number; driven: number; axle: number; rotor: number; motorOn: boolean }
export interface Motion { driver: number; driven: number; axle: number; rotor: number; motorOn: boolean }
export interface Motion { driver: number; driven: number; axle: number; rotor: number; motorOn: boolean }
export interface Motion { driver: number; driven: number; axle: number; rotor: number; motorOn: boolean }
export interface Motion { driver: number; driven: number; axle: number; rotor: number; motorOn: boolean }
export interface Motion { driver: number; driven: number; axle: number; rotor: number; motorOn: boolean }
export const STILL: Motion = { driver: 0, driven: 0, axle: 0, rotor: 0, motorOn: false };

/** Mechanical anchor points (model coordinates). Mechanical orientation is fixed; never mirrored in RTL. */
export const R = { x: 165, y: 240 }; // rotor centre (front of axle 12)
export const G = { x: 345, y: 212 }; // large driven gear centre (back of axle 12)
export const GEAR_R = 56;
const AXLE_Y = (x: number) => R.y + ((G.y - R.y) / (G.x - R.x)) * (x - R.x);

interface Ctx { m: Motion; teeth: { driver: number; driven: number } }
interface Ctx { m: Motion; teeth: { driver: number; driven: number } }
interface Ctx { m: Motion; teeth: { driver: number; driven: number } }

const pinion = (t: Ctx['teeth']) => {
  const r = (GEAR_R * t.driver) / t.driven;
  const d = GEAR_R + r - 4;
  return { x: G.x + d * 0.66, y: G.y + d * 0.75, r };
};

const LAYERS: Record<string, (c: Ctx) => ReactNode> = {
  foundation: () => (
    <g>
      <Brick x={50} y={440} w={262} h={12} tone="grey" studs={13} />
      <Brick x={70} y={384} w={222} h={28} tone="red" studs={11} holes={6} />
      <Brick x={70} y={412} w={60} h={28} tone="red" holes={2} top={false} />
      <Brick x={130} y={412} w={100} h={28} tone="green" holes={3} top={false} />
      <Brick x={230} y={412} w={62} h={28} tone="red" holes={2} top={false} />
      <Brick x={50} y={412} w={44} h={28} tone="red" studs={2} holes={1} />
      <Brick x={268} y={412} w={44} h={28} tone="red" studs={2} holes={1} />
    </g>
  ),
  braces: () => (
    <g>
      <Brick x={108} y={432} w={44} h={8} tone="red" studs={2} />
      <Brick x={208} y={432} w={44} h={8} tone="red" studs={2} />
      <Brick x={112} y={384} w={36} h={48} tone="green" studs={2} holes={1} />
      <Brick x={212} y={384} w={36} h={48} tone="green" studs={2} holes={1} />
    </g>
  ),
  platform: () => (
    <g>
      <Brick x={80} y={368} w={100} h={16} tone="red" studs={5} />
      <Brick x={180} y={368} w={100} h={16} tone="red" studs={5} />
    </g>
  ),
  course: () => (
    <g>
      <Brick x={80} y={336} w={110} h={32} tone="red" studs={5} holes={3} />
      <Brick x={190} y={336} w={90} h={32} tone="red" studs={4} holes={2} />
    </g>
  ),
  housing: () => (
    <g>
      <Brick x={100} y={300} w={160} h={36} tone="green" studs={8} holes={4} />
      <Brick x={100} y={296} w={26} h={6} tone="red" studs={1} />
      <Brick x={234} y={296} w={26} h={6} tone="red" studs={1} />
    </g>
  ),
  upper: (c) => (
    <g>
      <Brick x={100} y={268} w={50} h={32} tone="green" holes={2} top={false} />
      <Brick x={150} y={268} w={60} h={32} tone="red" holes={2} top={false} />
      <Brick x={210} y={268} w={50} h={32} tone="green" holes={2} top={false} />
      <Brick x={100} y={236} w={60} h={32} tone="red" holes={2} top={false} />
      <Brick x={160} y={236} w={50} h={32} tone="green" holes={2} top={false} />
      <Brick x={210} y={236} w={50} h={32} tone="red" holes={2} top={false} />
      <Brick x={100} y={204} w={50} h={32} tone="green" studs={3} holes={2} />
      <Brick x={150} y={204} w={60} h={32} tone="red" studs={3} holes={2} />
      <Brick x={210} y={204} w={50} h={32} tone="green" studs={3} holes={2} />
      <Axle x1={118} y1={AXLE_Y(118)} x2={410} y2={AXLE_Y(410)} label="12" angle={c.m.axle} />
    </g>
  ),
  gears: (c) => (
    <g>
      <rect x={268} y={AXLE_Y(275) - 8} width={12} height={16} rx={3} fill={C.yellow.b} stroke={C.yellow.d} />
      <Gear cx={G.x} cy={G.y} r={GEAR_R} teeth={c.teeth.driven} angle={c.m.driven} />
      <Gear cx={G.x + 30} cy={AXLE_Y(G.x + 30)} r={(GEAR_R * c.teeth.driver) / c.teeth.driven} teeth={c.teeth.driver} angle={c.m.axle} tone="grey" />
      <rect x={396} y={AXLE_Y(400) - 7} width={10} height={14} rx={3} fill={C.grey.l} stroke={C.grey.d} />
    </g>
  ),
  hub: (c) => (
    <g transform={`rotate(${c.m.rotor} ${R.x} ${R.y})`}>
      <Brick x={R.x - 58} y={R.y - 13} w={116} h={26} tone="red" holes={7} top={false} />
      <Brick x={R.x - 13} y={R.y - 58} w={26} h={116} tone="red" holes={0} top={false} />
      {[-40, -24, 24, 40].map((d) => <circle key={d} cx={R.x} cy={R.y + d} r={4.5} fill={C.red.d} />)}
      <circle cx={R.x} cy={R.y} r={11} fill={C.yellow.b} stroke={C.yellow.d} />
      <CrossEnd cx={R.x} cy={R.y} />
    </g>
  ),
  'motor-base': () => (
    <g>
      <Brick x={392} y={424} w={60} h={12} tone="red" studs={3} />
      <Brick x={452} y={424} w={50} h={12} tone="green" studs={3} />
      <Brick x={502} y={424} w={66} h={12} tone="red" studs={3} />
      <Brick x={404} y={384} w={156} h={40} tone="yellow" holes={8} top={false} />
      <Brick x={404} y={344} w={156} h={40} tone="dark" holes={8} top={false} />
      <Brick x={404} y={304} w={156} h={40} tone="yellow" holes={8} top={false} />
      <Brick x={404} y={296} w={156} h={8} tone="red" studs={8} />
    </g>
  ),
  motor: (c) => {
    const p = pinion(c.teeth);
    return (
      <g>
        <Motor x={412} y={p.y - 30} w={142} h={60} on={c.m.motorOn} shaftAngle={c.m.driver} />
        <Axle x1={412} y1={p.y} x2={p.x - 18} y2={p.y} angle={c.m.driver} />
        <Gear cx={p.x} cy={p.y} r={p.r} teeth={c.teeth.driver} angle={c.m.driver} />
        <circle cx={p.x - 26} cy={p.y + 24} r={10} fill="#FFFEFA" stroke="#2459C6" strokeWidth={1.5} />
        <text x={p.x - 26} y={p.y + 28} textAnchor="middle" fontSize={11} fontWeight={700} fill="#2459C6" fontFamily="Space Mono, monospace">6</text>
      </g>
    );
  },
  join: () => (
    <g>
      <Brick x={306} y={412} w={46} h={28} tone="red" studs={2} holes={1} />
      <Brick x={352} y={412} w={46} h={28} tone="red" studs={2} holes={1} />
      <Brick x={300} y={404} w={104} h={8} tone="green" studs={5} />
    </g>
  ),
  supports: () => (
    <g>
      <path d="M396 446 Q 440 414 520 420 L 524 446 Z" fill={C.yellow.b} stroke={C.yellow.d} strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M400 446 Q 444 424 520 430" fill="none" stroke={C.yellow.l} strokeWidth={2} />
      <path d="M470 448 Q 506 426 566 430 L 568 448 Z" fill={C.yellow.b} stroke={C.yellow.d} strokeWidth={1.2} strokeLinejoin="round" />
      <Slope x={560} y={300} w={46} h={40} tone="red" flip />
      <Slope x={560} y={384} w={46} h={40} tone="red" flip />
      <rect x={584} y={312} width={10} height={10} fill="none" stroke={C.red.d} strokeWidth={1.4} />
    </g>
  ),
  finish: () => (
    <g>
      <Slope x={52} y={392} w={58} h={48} tone="blue" />
      <Slope x={204} y={392} w={64} h={48} tone="blue" />
      <Brick x={96} y={182} w={84} h={22} tone="red" studs={4} holes={2} />
      <Brick x={180} y={182} w={84} h={22} tone="red" studs={4} holes={2} />
      <Brick x={128} y={172} w={104} h={10} tone="red" studs={5} />
    </g>
  ),
  blades: (c) => (
    <g transform={`rotate(${c.m.rotor} ${R.x} ${R.y})`}>
      {[0, 90, 180, 270].map((a) => (
        <g key={a} transform={`rotate(${a} ${R.x} ${R.y})`}>
          <Blade x={R.x + 8} y={R.y - 34} len={118} wid={22} />
        </g>
      ))}
      <circle cx={R.x} cy={R.y} r={11} fill={C.yellow.b} stroke={C.yellow.d} />
      <CrossEnd cx={R.x} cy={R.y} angle={0} />
    </g>
  ),
};

/** Paint order: tower, motor unit, then the rotor in front so blades never cover the gear pair. */
const Z = ['foundation', 'braces', 'platform', 'course', 'housing', 'upper', 'finish', 'join', 'motor-base', 'supports', 'gears', 'motor', 'hub', 'blades'];

export function LayerArt({ id, lesson, motion = STILL }: { id: string; lesson: Lesson; motion?: Motion }) {
  const fn = LAYERS[id];
  const t = lesson.transmission;
  return <>{fn ? fn({ m: motion, teeth: { driver: t.driverTeeth, driven: t.drivenTeeth } }) : null}</>;
}

export function WindmillModel({ lesson, placed, motion, newest, popKey = 0, preview, direction = 1 }: {
  lesson: Lesson; placed: readonly string[]; motion: Motion; newest?: string | null; popKey?: number;
  /** Step id drawn as a non-saved preview (animated, translucent). */
  preview?: string | null; direction?: 1 | -1;
}) {
  const shown = preview ? [...placed, preview] : placed;
  const layerIds = lesson.steps.filter((s) => shown.includes(s.id)).map((s) => s.svgLayer.id);
  const joined = shown.includes(lesson.joinStepId);
  const previewLayer = lesson.steps.find((s) => s.id === preview)?.svgLayer.id;
  const newestLayer = previewLayer ?? lesson.steps.find((s) => s.id === newest)?.svgLayer.id;
  const t = lesson.transmission;
  const p = pinion({ driver: t.driverTeeth, driven: t.drivenTeeth });
  const complete = placed.length === lesson.steps.length;
  return (
    <g>
      {Z.filter((id) => layerIds.includes(id)).map((id) => {
        const off = !joined && lesson.detachedLayers.includes(id) ? lesson.detachedOffset : { x: 0, y: 0 };
        return (
          <g key={id} data-testid={`model-layer-${id}`} transform={`translate(${off.x} ${off.y})`} className="wm-layer-shift">
            <g key={id === newestLayer ? `p${popKey}` : 'still'} className={id === newestLayer ? `wm-pop${id === previewLayer ? ' wm-preview' : ''}` : undefined}>
              <LayerArt id={id} lesson={lesson} motion={motion} />
            </g>
          </g>
        );
      })}
      {complete && motion.motorOn && (
        <g pointerEvents="none" aria-hidden="true">
          <path
            d={`M540 ${p.y} L${p.x} ${p.y} Q ${(p.x + G.x) / 2 + 10} ${(p.y + G.y) / 2 + 10} ${G.x} ${G.y} L${R.x} ${R.y}`}
            fill="none" stroke="#00A9D6" strokeWidth={3} strokeDasharray="8 8" strokeDashoffset={-motion.driver * 0.27} strokeLinecap="round" opacity={0.95}
          />
          {/* Direction cues follow the motor direction: forward = pinion clockwise, driven counter-clockwise. */}
          <path d={`M${p.x + 28} ${p.y - 6} A 28 28 0 0 1 ${p.x + 4} ${p.y + 28}`} fill="none" stroke="#102047" strokeWidth={2.5} markerEnd={direction === 1 ? 'url(#wm-arrow)' : undefined} markerStart={direction === -1 ? 'url(#wm-arrow)' : undefined} data-testid="arrow-driver" />
          <path d={`M${G.x + 20} ${G.y - 66} A 70 70 0 0 0 ${G.x - 50} ${G.y - 48}`} fill="none" stroke="#102047" strokeWidth={2.5} markerEnd={direction === 1 ? 'url(#wm-arrow)' : undefined} markerStart={direction === -1 ? 'url(#wm-arrow)' : undefined} data-testid="arrow-driven" />
        </g>
      )}
    </g>
  );
}

export function ArrowDefs() {
  return (
    <defs>
      <marker id="wm-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
        <path d="M0 0 L10 5 L0 10 z" fill="#102047" />
      </marker>
    </defs>
  );
}
