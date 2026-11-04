/** Reusable original SVG brick-kit primitives (studs, holes, axles, gears, motor, slopes, blades). */
export const C = {
  red: { b: '#DF2935', d: '#A31B25', l: '#F2646C' },
  green: { b: '#47B34F', d: '#2C7C33', l: '#7AD180' },
  yellow: { b: '#F6C90E', d: '#B8930A', l: '#FFE265' },
  blue: { b: '#2459C6', d: '#163C8C', l: '#5583E3' },
  grey: { b: '#AEB3B9', d: '#7A8087', l: '#D3D7DB' },
  dark: { b: '#4E535B', d: '#2D3136', l: '#737982' },
  black: { b: '#24272D', d: '#121418', l: '#4A4F58' },
} as const;
export type Tone = keyof typeof C;
const DX = 8;
const DY = -6;

export function Brick({ x, y, w, h, tone, studs = 0, holes = 0, top = true }: {
  x: number; y: number; w: number; h: number; tone: Tone; studs?: number; holes?: number; top?: boolean;
}) {
  const c = C[tone];
  const hr = holes ? Math.min(h * 0.27, (w / holes) * 0.3) : 0;
  return (
    <g>
      {top && <polygon points={`${x},${y} ${x + DX},${y + DY} ${x + w + DX},${y + DY} ${x + w},${y}`} fill={c.l} stroke={c.d} strokeWidth={0.8} />}
      <polygon points={`${x + w},${y} ${x + w + DX},${y + DY} ${x + w + DX},${y + h + DY} ${x + w},${y + h}`} fill={c.d} />
      <rect x={x} y={y} width={w} height={h} fill={c.b} stroke={c.d} strokeWidth={1.1} />
      <rect x={x + 1.5} y={y + 1.5} width={w - 3} height={1.8} fill={c.l} opacity={0.65} />
      {top && Array.from({ length: studs }, (_, i) => {
        const sx = x + ((i + 0.5) * w) / studs + DX / 2;
        const sy = y + DY / 2;
        return (
          <g key={i}>
            <rect x={sx - 3.4} y={sy - 3.6} width={6.8} height={3.6} fill={c.d} />
            <ellipse cx={sx} cy={sy - 3.6} rx={3.4} ry={1.5} fill={c.l} stroke={c.d} strokeWidth={0.6} />
          </g>
        );
      })}
      {Array.from({ length: holes }, (_, i) => {
        const hx = x + ((i + 0.5) * w) / holes;
        const hy = y + h / 2;
        return (
          <g key={`h${i}`}>
            <circle cx={hx} cy={hy} r={hr} fill={c.d} />
            <circle cx={hx + 0.6} cy={hy + 0.6} r={hr * 0.62} fill="#15171b" opacity={0.45} />
          </g>
        );
      })}
    </g>
  );
}

/** Black cross axle with cross-shaped ends and an optional length label. */
export function Axle({ x1, y1, x2, y2, label, angle = 0 }: { x1: number; y1: number; x2: number; y2: number; label?: string; angle?: number }) {
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={C.black.b} strokeWidth={6} strokeLinecap="round" />
      <line x1={x1} y1={y1 - 1.6} x2={x2} y2={y2 - 1.6} stroke={C.black.l} strokeWidth={1.4} />
      <CrossEnd cx={x2} cy={y2} angle={angle} />
      {label && (
        <g>
          <circle cx={x2 + 14} cy={y2 - 14} r={10} fill="#FFFEFA" stroke="#2459C6" strokeWidth={1.5} />
          <text x={x2 + 14} y={y2 - 10.5} textAnchor="middle" fontSize={11} fontWeight={700} fill="#2459C6" fontFamily="Space Mono, monospace">{label}</text>
        </g>
      )}
    </g>
  );
}

export function CrossEnd({ cx, cy, angle = 0, r = 4.5 }: { cx: number; cy: number; angle?: number; r?: number }) {
  return (
    <g transform={`rotate(${angle} ${cx} ${cy})`}>
      <circle cx={cx} cy={cy} r={r + 1.5} fill={C.black.d} />
      <rect x={cx - r} y={cy - 1.3} width={r * 2} height={2.6} fill={C.black.l} />
      <rect x={cx - 1.3} y={cy - r} width={2.6} height={r * 2} fill={C.black.l} />
    </g>
  );
}

export function gearPath(cx: number, cy: number, r: number, teeth: number) {
  const depth = Math.max(3.2, r * 0.13);
  const pitch = (Math.PI * 2) / teeth;
  const pts: string[] = [];
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch;
    const steps: [number, number][] = [[a, r - depth], [a + pitch * 0.22, r], [a + pitch * 0.5, r], [a + pitch * 0.72, r - depth]];
    for (const [ang, rad] of steps) pts.push(`${(cx + Math.cos(ang) * rad).toFixed(2)},${(cy + Math.sin(ang) * rad).toFixed(2)}`);
  }
  return `M${pts.join('L')}Z`;
}

/** Spur gear: tooth count is drawn exactly (teeth prop) so the visible ratio matches the configured transmission. */
export function Gear({ cx, cy, r, teeth, angle = 0, tone = 'grey' }: { cx: number; cy: number; r: number; teeth: number; angle?: number; tone?: Tone }) {
  const c = C[tone];
  const spokes = teeth >= 24 ? 6 : 0;
  return (
    <g transform={`rotate(${angle} ${cx} ${cy})`}>
      <path d={gearPath(cx + 2, cy + 2, r, teeth)} fill={c.d} opacity={0.5} />
      <path d={gearPath(cx, cy, r, teeth)} fill={c.b} stroke={c.d} strokeWidth={1} strokeLinejoin="round" />
      <circle cx={cx} cy={cy} r={r * 0.78} fill="none" stroke={c.d} strokeWidth={1} opacity={0.6} />
      {Array.from({ length: spokes }, (_, i) => {
        const a = (i * Math.PI * 2) / spokes;
        return <circle key={i} cx={cx + Math.cos(a) * r * 0.5} cy={cy + Math.sin(a) * r * 0.5} r={r * 0.13} fill={c.d} />;
      })}
      <circle cx={cx} cy={cy} r={Math.max(6, r * 0.24)} fill={c.l} stroke={c.d} strokeWidth={1} />
      <rect x={cx - 1.5} y={cy - r * 0.92} width={3} height={6} fill="#DF2935" opacity={0.9} />
      <CrossEnd cx={cx} cy={cy} r={4} />
    </g>
  );
}

export function Motor({ x, y, w, h, on, shaftAngle }: { x: number; y: number; w: number; h: number; on: boolean; shaftAngle: number }) {
  const cy = y + h / 2;
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={h * 0.32} fill={C.grey.b} stroke={C.grey.d} strokeWidth={1.2} />
      <rect x={x + 6} y={y + 6} width={w - 12} height={h * 0.22} rx={4} fill={C.grey.l} opacity={0.8} />
      {[0.45, 0.6, 0.75].map((f) => <line key={f} x1={x + w * f} y1={y + 4} x2={x + w * f} y2={y + h - 4} stroke={C.grey.d} strokeWidth={1} opacity={0.5} />)}
      <rect x={x + w - 26} y={y + h * 0.2} width={20} height={h * 0.6} rx={4} fill={C.dark.b} />
      <ellipse cx={x + 4} cy={cy} rx={8} ry={h / 2 - 2} fill={C.dark.b} stroke={C.dark.d} />
      <circle cx={x + w - 16} cy={y + h * 0.5} r={4} fill={on ? '#47B34F' : '#7A8087'} stroke="#2D3136" strokeWidth={1} />
      <CrossEnd cx={x + 2} cy={cy} angle={shaftAngle} r={4} />
    </g>
  );
}

export function Slope({ x, y, w, h, tone, flip = false }: { x: number; y: number; w: number; h: number; tone: Tone; flip?: boolean }) {
  const c = C[tone];
  const pts = flip
    ? `${x},${y} ${x + w * 0.35},${y} ${x + w},${y + h * 0.75} ${x + w},${y + h} ${x},${y + h}`
    : `${x},${y + h * 0.75} ${x + w * 0.65},${y} ${x + w},${y} ${x + w},${y + h} ${x},${y + h}`;
  return (
    <g>
      <polygon points={pts} fill={c.b} stroke={c.d} strokeWidth={1.1} strokeLinejoin="round" />
      <circle cx={flip ? x + w * 0.3 : x + w * 0.7} cy={y + h * 0.7} r={3.2} fill={c.d} />
    </g>
  );
}

/** Yellow studded blade beam seen face-on (top studs drawn as rings). */
export function Blade({ x, y, len, wid }: { x: number; y: number; len: number; wid: number }) {
  const n = Math.round(len / 16);
  return (
    <g>
      <rect x={x} y={y} width={len} height={wid} rx={3} fill={C.yellow.b} stroke={C.yellow.d} strokeWidth={1.2} />
      {Array.from({ length: n }, (_, i) => (
        <g key={i}>
          <circle cx={x + ((i + 0.5) * len) / n} cy={y + wid / 2} r={wid * 0.27} fill={C.yellow.l} stroke={C.yellow.d} strokeWidth={1} />
          <circle cx={x + ((i + 0.5) * len) / n} cy={y + wid / 2} r={wid * 0.13} fill={C.yellow.d} opacity={0.55} />
        </g>
      ))}
    </g>
  );
}
