import type { ReactNode } from 'react';
import { Axle, Blade, Brick, C, CrossEnd, Gear, Motor } from '@/components/parts/Bricks';
import type { Lesson } from '@/data/lessons/windmill';
import type { FxStrings } from '@/i18n/features';
import type { Motion } from '@/components/model/WindmillModel';

interface P { lesson: Lesson; placed: readonly string[]; motion: Motion; f: FxStrings; direction?: 1 | -1 }

const INK = '#102047';
const useHas = (lesson: Lesson, placed: readonly string[]) => {
  const ids = lesson.steps.filter((s) => placed.includes(s.id)).map((s) => s.svgLayer.id);
  return (id: string) => ids.includes(id);
};
function Missing({ x, y, w, h, rx = 8 }: { x: number; y: number; w: number; h: number; rx?: number }) {
  return <rect x={x} y={y} width={w} height={h} rx={rx} fill="none" stroke="#7d8aa8" strokeWidth={1.5} strokeDasharray="6 5" />;
}
function Label({ x, y, tx, ty, children, anchor = 'start' }: { x: number; y: number; tx: number; ty: number; children: ReactNode; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <g>
      <line x1={x} y1={y} x2={tx} y2={ty + (ty > y ? -12 : 4)} stroke={INK} strokeWidth={1} />
      <circle cx={x} cy={y} r={3} fill={INK} />
      <text x={tx} y={ty} textAnchor={anchor} fontSize={13} fontWeight={700} fill={INK} fontFamily="Space Mono, monospace" style={{ paintOrder: 'stroke' }} stroke="#FFFEFA" strokeWidth={4}>{children}</text>
    </g>
  );
}
const SchematicTag = ({ w, text }: { w: number; text: string }) => (
  <text x={w - 10} y={20} textAnchor="end" fontSize={11} fill="#48557A" fontFamily="Space Mono, monospace">{text}</text>
);

/** Rear elevation: plain rear brick faces, large gear nearest the viewer, blades on the far side. */
export function BackView({ lesson, placed, motion, f }: P) {
  const has = useHas(lesson, placed);
  const t = lesson.transmission;
  const rc = { x: 440, y: 200 }; // rotor centre seen from behind
  const gc = { x: 262, y: 176 };
  const pr = (56 * t.driverTeeth) / t.drivenTeeth;
  return (
    <svg viewBox="0 0 640 400" role="img" aria-label={f.viewSr.back}>
      <SchematicTag w={640} text="REAR · SCHEMATIC" />
      {/* Blades behind the tower: only outlines are visible from the rear. */}
      {has('blades') ? (
        <g transform={`rotate(${-motion.rotor} ${rc.x} ${rc.y})`} opacity={0.45}>
          {[0, 90, 180, 270].map((a) => <rect key={a} x={rc.x + 14} y={rc.y - 11} width={116} height={22} rx={6} fill={C.yellow.b} stroke={C.yellow.d} transform={`rotate(${a} ${rc.x} ${rc.y})`} />)}
        </g>
      ) : <Missing x={rc.x - 120} y={rc.y - 120} w={240} h={240} rx={120} />}
      {/* Tower rear wall */}
      {has('foundation') ? <Brick x={348} y={360} w={262} h={14} tone="grey" /> : <Missing x={348} y={346} w={262} h={28} />}
      {has('foundation') && <Brick x={368} y={316} w={222} h={44} tone="red" top={false} />}
      {has('platform') && <Brick x={378} y={300} w={200} h={16} tone="red" top={false} />}
      {has('course') && <Brick x={378} y={268} w={200} h={32} tone="red" top={false} />}
      {has('housing') && <Brick x={398} y={232} w={160} h={36} tone="green" holes={4} top={false} />}
      {has('upper') ? <Brick x={398} y={136} w={160} h={96} tone="green" holes={3} top={false} /> : <Missing x={398} y={136} w={160} h={96} />}
      {has('finish') && <Brick x={394} y={114} w={168} h={22} tone="red" studs={8} />}
      <text x={478} y={392} textAnchor="middle" fontSize={11} fill="#48557A" fontFamily="Space Mono, monospace">{f.labels.rear}</text>
      {/* Main axle passes through to the gear side */}
      {has('upper') && <Axle x1={gc.x - 20} y1={gc.y} x2={rc.x} y2={rc.y} angle={-motion.axle} />}
      {/* Motor platform on the left when viewed from behind */}
      {has('motor-base') ? <Brick x={60} y={300} w={170} h={60} tone="yellow" holes={8} top={false} /> : <Missing x={60} y={300} w={170} h={60} />}
      {has('join') && <Brick x={230} y={340} w={118} h={20} tone="red" studs={5} />}
      {has('motor') && <Motor x={80} y={gc.y + 52} w={140} h={50} on={motion.motorOn} shaftAngle={-motion.driver} />}
      {has('gears') ? (
        <>
          <Gear cx={gc.x} cy={gc.y} r={56} teeth={t.drivenTeeth} angle={-motion.driven} />
          <Label x={gc.x} y={gc.y - 56} tx={gc.x - 20} ty={60} anchor="middle">{f.labels.driven(t.drivenTeeth)}</Label>
        </>
      ) : <Missing x={gc.x - 56} y={gc.y - 56} w={112} h={112} rx={56} />}
      {has('motor') && <Gear cx={gc.x - 14} cy={gc.y + 56 + pr - 6} r={pr} teeth={t.driverTeeth} angle={-motion.driver} />}
      <text x={20} y={30} fontSize={12} fill={INK} fontFamily="Space Mono, monospace">{f.labels.platform}</text>
    </svg>
  );
}

/** Close-up of the gear mesh with tooth counts, axles and direction arrows. */
export function GearView({ lesson, placed, motion, f, direction = 1 }: P) {
  const has = useHas(lesson, placed);
  const t = lesson.transmission;
  const R = 110, r = (R * t.driverTeeth) / t.drivenTeeth;
  const g = { x: 190, y: 170 };
  const p = { x: g.x + R + r - 6, y: g.y + 60 };
  const ang = Math.atan2(p.y - g.y, p.x - g.x);
  const d = Math.hypot(p.x - g.x, p.y - g.y);
  const pp = { x: g.x + Math.cos(ang) * d, y: g.y + Math.sin(ang) * d };
  const mesh = { x: g.x + Math.cos(ang) * R, y: g.y + Math.sin(ang) * R };
  const fwd = direction === 1;
  return (
    <svg viewBox="0 0 560 340" role="img" aria-label={f.viewSr.gears}>
      <defs>
        <marker id="gv-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill={INK} /></marker>
      </defs>
      <SchematicTag w={560} text="GEAR MESH · SCHEMATIC" />
      {has('gears') ? <Gear cx={g.x} cy={g.y} r={R} teeth={t.drivenTeeth} angle={motion.driven} /> : <Missing x={g.x - R} y={g.y - R} w={R * 2} h={R * 2} rx={R} />}
      {has('motor') ? <Gear cx={pp.x} cy={pp.y} r={r} teeth={t.driverTeeth} angle={motion.driver + 180 / t.driverTeeth} /> : <Missing x={pp.x - r} y={pp.y - r} w={r * 2} h={r * 2} rx={r} />}
      {has('motor') && <Axle x1={pp.x} y1={pp.y} x2={548} y2={pp.y} label="6" angle={motion.driver} />}
      <path d={`M${pp.x + r + 10} ${pp.y - 20} A ${r + 14} ${r + 14} 0 0 1 ${pp.x + 10} ${pp.y + r + 12}`} fill="none" stroke={INK} strokeWidth={2.5}
        markerEnd={fwd ? 'url(#gv-arrow)' : undefined} markerStart={fwd ? undefined : 'url(#gv-arrow)'} />
      <path d={`M${g.x + 40} ${g.y - R - 14} A ${R + 16} ${R + 16} 0 0 0 ${g.x - 80} ${g.y - R + 20}`} fill="none" stroke={INK} strokeWidth={2.5}
        markerEnd={fwd ? 'url(#gv-arrow)' : undefined} markerStart={fwd ? undefined : 'url(#gv-arrow)'} />
      <circle cx={mesh.x} cy={mesh.y} r={14} fill="none" stroke="#00A9D6" strokeWidth={3} strokeDasharray="4 4" />
      <Label x={mesh.x + 10} y={mesh.y - 10} tx={380} ty={70}>{f.labels.mesh}</Label>
      <Label x={g.x - 30} y={g.y + 40} tx={30} ty={330}>{f.labels.driven(t.drivenTeeth)} · {f.labels.axle12}</Label>
      <Label x={pp.x} y={pp.y + r} tx={380} ty={330}>{f.labels.driver(t.driverTeeth)} · {f.labels.axle6}</Label>
    </svg>
  );
}

/** Exploded assembly pulled apart along the main axle. */
export function ExplodedView({ lesson, placed, motion, f }: P) {
  const has = useHas(lesson, placed);
  const t = lesson.transmission;
  const y = 150;
  const pr = (60 * t.driverTeeth) / t.drivenTeeth;
  return (
    <svg viewBox="0 0 800 320" role="img" aria-label={f.viewSr.exploded}>
      <SchematicTag w={800} text="EXPLODED · SCHEMATIC" />
      <line x1={30} y1={y} x2={600} y2={y} stroke="#7d8aa8" strokeWidth={1.5} strokeDasharray="3 6" />
      {has('upper') ? <Axle x1={200} y1={y} x2={560} y2={y} angle={motion.axle} /> : <Missing x={200} y={y - 6} w={360} h={12} rx={4} />}
      <Label x={380} y={y + 6} tx={380} ty={300} anchor="middle">{f.labels.axle12}</Label>
      {/* Blades */}
      <g>
        {has('blades') ? (
          <g transform={`rotate(${motion.rotor} 80 ${y})`}>
            {[0, 90, 180, 270].map((a) => <g key={a} transform={`rotate(${a} 80 ${y})`}><Blade x={86} y={y - 18} len={52} wid={12} /></g>)}
            <CrossEnd cx={80} cy={y} />
          </g>
        ) : <Missing x={20} y={y - 60} w={120} h={120} rx={60} />}
        <Label x={80} y={y - 60} tx={60} ty={34}>{f.labels.blades}</Label>
      </g>
      {/* Hub */}
      {has('hub') ? (
        <g transform={`rotate(${motion.rotor} 170 ${y})`}>
          <Brick x={140} y={y - 10} w={60} h={20} tone="red" top={false} />
          <Brick x={160} y={y - 30} w={20} h={60} tone="red" top={false} />
          <circle cx={170} cy={y} r={8} fill={C.yellow.b} stroke={C.yellow.d} />
        </g>
      ) : <Missing x={140} y={y - 30} w={60} h={60} />}
      <Label x={170} y={y + 30} tx={150} ty={240}>{f.labels.rotor}</Label>
      {/* Tower slice */}
      {has('upper') ? <Brick x={250} y={y - 50} w={80} h={180} tone="green" holes={3} top={false} /> : <Missing x={250} y={y - 50} w={80} h={180} />}
      <Label x={330} y={y - 40} tx={300} ty={44}>{f.labels.tower}</Label>
      {/* Bush */}
      {has('gears') ? <rect x={372} y={y - 9} width={14} height={18} rx={3} fill={C.yellow.b} stroke={C.yellow.d} /> : <Missing x={372} y={y - 9} w={14} h={18} rx={3} />}
      {/* Driven gear */}
      {has('gears') ? <Gear cx={460} cy={y} r={60} teeth={t.drivenTeeth} angle={motion.driven} /> : <Missing x={400} y={y - 60} w={120} h={120} rx={60} />}
      <Label x={490} y={y - 52} tx={480} ty={34}>{f.labels.driven(t.drivenTeeth)}</Label>
      {/* Driver gear + motor, dropped below to show they are a separate unit */}
      {has('motor') ? (
        <>
          <Gear cx={620} cy={y + 90} r={pr} teeth={t.driverTeeth} angle={motion.driver} />
          <Axle x1={620} y1={y + 90} x2={680} y2={y + 90} angle={motion.driver} />
          <Motor x={680} y={y + 66} w={100} h={48} on={motion.motorOn} shaftAngle={motion.driver} />
        </>
      ) : <Missing x={600} y={y + 60} w={180} h={60} />}
      <line x1={600} y1={y + 70} x2={510} y2={y + 30} stroke="#00A9D6" strokeWidth={2} strokeDasharray="5 5" />
      <Label x={620} y={y + 90 - pr} tx={600} ty={70}>{f.labels.driver(t.driverTeeth)}</Label>
      <Label x={730} y={y + 114} tx={720} ty={300} anchor="middle">{f.labels.motor} · {f.labels.axle6}</Label>
    </svg>
  );
}
