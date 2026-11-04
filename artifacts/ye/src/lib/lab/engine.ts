import type { Lesson, Placements, ReasonCode, StatusCode, StepDef } from './types';

export type PlaceResult = { ok: true; placements: Placements } | { ok: false; reason: ReasonCode; missingSlot?: string };
export type RemoveResult = { ok: true; placements: Placements } | { ok: false; blockedBy: string[] };
export type Direction = 1 | -1; // 1 = clockwise (screen), -1 = counter-clockwise

export interface Simulation {
  status: StatusCode;
  success: boolean;
  /** Axis id -> direction for every axis that turns. */
  axes: Record<string, Direction>;
  /** Slot id -> direction for every placed moving part that turns. */
  moving: Record<string, Direction>;
}

export const getPart = (lesson: Lesson, id: string) => lesson.parts.find((p) => p.id === id);
export const getSlot = (lesson: Lesson, id: string) => lesson.slots.find((s) => s.id === id);

export function countUsed(placements: Placements, partId: string): number {
  return Object.values(placements).filter((p) => p.partId === partId).length;
}

export function remaining(lesson: Lesson, placements: Placements, partId: string): number {
  const part = getPart(lesson, partId);
  return part ? part.quantity - countUsed(placements, partId) : 0;
}

export function totalPieces(lesson: Lesson): number {
  return lesson.parts.reduce((n, p) => n + p.quantity, 0);
}

/** Pure check: can `partId` in `orientation` attach at `slotId`? */
export function canPlace(lesson: Lesson, placements: Placements, partId: string, slotId: string, orientation: string): { ok: true } | { ok: false; reason: ReasonCode; missingSlot?: string } {
  const part = getPart(lesson, partId);
  const slot = getSlot(lesson, slotId);
  if (!part || !slot) return { ok: false, reason: 'unknown' };
  if (remaining(lesson, placements, partId) <= 0) return { ok: false, reason: 'none-left' };
  if (placements[slotId]) return { ok: false, reason: 'slot-occupied' };
  if (slot.accepts !== partId) return { ok: false, reason: 'wrong-part' };
  const missing = slot.requires.find((r) => !placements[r]);
  if (missing) return { ok: false, reason: 'missing-dependency', missingSlot: missing };
  if (!slot.orientations.includes(orientation)) return { ok: false, reason: 'wrong-orientation' };
  return { ok: true };
}

export function placePart(lesson: Lesson, placements: Placements, partId: string, slotId: string, orientation: string): PlaceResult {
  const c = canPlace(lesson, placements, partId, slotId, orientation);
  if (!c.ok) return c;
  return { ok: true, placements: { ...placements, [slotId]: { partId, orientation } } };
}

/** Slots currently filled that depend (directly) on `slotId`. */
export function dependentsOf(lesson: Lesson, placements: Placements, slotId: string): string[] {
  return lesson.slots.filter((s) => placements[s.id] && s.requires.includes(slotId)).map((s) => s.id);
}

export function removePart(lesson: Lesson, placements: Placements, slotId: string): RemoveResult {
  if (!placements[slotId]) return { ok: false, blockedBy: [] };
  const blockedBy = dependentsOf(lesson, placements, slotId);
  if (blockedBy.length) return { ok: false, blockedBy };
  const next = { ...placements };
  delete next[slotId];
  return { ok: true, placements: next };
}

/** Pure motion propagation from the input part through axles and meshing gears. */
export function simulate(lesson: Lesson, placements: Placements): Simulation {
  const filled = lesson.slots.filter((s) => placements[s.id]);
  const roleAt = (slotId: string) => getPart(lesson, placements[slotId].partId)?.role;
  const axes: Record<string, Direction> = {};
  const moving: Record<string, Direction> = {};
  const axisPos = (id: string) => lesson.axes.find((a) => a.id === id);
  const hasAxle = (axis: string) => filled.some((s) => s.axis === axis && roleAt(s.id) === 'axle');

  const inputs = filled.filter((s) => roleAt(s.id) === 'input' && s.axis && hasAxle(s.axis));
  const queue: string[] = [];
  for (const s of inputs) if (!axes[s.axis!]) { axes[s.axis!] = 1; queue.push(s.axis!); }

  const gears = filled.filter((s) => roleAt(s.id) === 'gear' && s.axis);
  while (queue.length) {
    const a = queue.shift()!;
    const pa = axisPos(a);
    const ga = gears.find((g) => g.axis === a);
    if (!pa || !ga) continue;
    const ra = getPart(lesson, placements[ga.id].partId)?.radius ?? 0;
    for (const gb of gears) {
      if (gb.axis === a || axes[gb.axis!] !== undefined || !hasAxle(gb.axis!)) continue;
      const pb = axisPos(gb.axis!);
      if (!pb) continue;
      const rb = getPart(lesson, placements[gb.id].partId)?.radius ?? 0;
      const d = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      if (Math.abs(d - (ra + rb)) <= lesson.meshTolerance) {
        axes[gb.axis!] = (axes[a] * -1) as Direction;
        queue.push(gb.axis!);
      }
    }
  }
  for (const s of filled) if (s.axis && axes[s.axis] !== undefined) moving[s.id] = axes[s.axis];

  const output = filled.find((s) => placements[s.id].partId === lesson.success.outputPart);
  let status: StatusCode;
  if (!filled.length) status = 'empty';
  else if (!inputs.length) status = 'no-input';
  else if (output && moving[output.id]) status = 'success';
  else {
    const turningGears = gears.filter((g) => moving[g.id]);
    if (!turningGears.length) status = 'input-no-gear';
    else if (gears.length < 2) status = 'missing-follower';
    else if (turningGears.length < gears.length) status = 'gears-not-meshed';
    else if (!output) status = 'output-missing';
    else status = 'output-still';
  }
  return { status, success: status === 'success', axes, moving };
}

/** First step not yet satisfied, or null when every step is done. */
export function currentStep(lesson: Lesson, placements: Placements): StepDef | null {
  return lesson.steps.find((st) => {
    const slot = getSlot(lesson, st.slot);
    return !slot || placements[st.slot]?.partId !== slot.accepts;
  }) ?? null;
}

/** Build the placements produced by the first `n` steps (used by instructor demo). */
export function placementsForSteps(lesson: Lesson, n: number): Placements {
  let p: Placements = {};
  for (const st of lesson.steps.slice(0, n)) {
    const slot = getSlot(lesson, st.slot);
    if (!slot) continue;
    const r = placePart(lesson, p, slot.accepts, slot.id, slot.orientations[0]);
    if (r.ok) p = r.placements;
  }
  return p;
}

/** Re-validate untrusted placements (e.g. from localStorage). Returns null if invalid. */
export function validatePlacements(lesson: Lesson, raw: unknown): Placements | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const entries = Object.entries(raw as Record<string, unknown>);
  let p: Placements = {};
  let pending = entries;
  while (pending.length) {
    const next: typeof pending = [];
    for (const [slotId, v] of pending) {
      if (!v || typeof v !== 'object') return null;
      const { partId, orientation } = v as Record<string, unknown>;
      if (typeof partId !== 'string' || typeof orientation !== 'string') return null;
      const r = placePart(lesson, p, partId, slotId, orientation);
      if (r.ok) p = r.placements;
      else if (r.reason === 'missing-dependency') next.push([slotId, v]);
      else return null;
    }
    if (next.length === pending.length) return null;
    pending = next;
  }
  return p;
}

/** Pure angle helper for rendering: gear on axis rotates by dir*theta, followers offset by half a tooth. */
export function partAngle(theta: number, dir: Direction | undefined, phase = 0): number {
  return dir ? dir * theta + phase : phase;
}
