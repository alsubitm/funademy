import { describe, expect, it } from 'vitest';
import { gearFanLesson as lesson } from '@/lib/lab/gear-fan';
import { canPlace, currentStep, placePart, placementsForSteps, remaining, removePart, simulate, totalPieces, validatePlacements } from '@/lib/lab/engine';
import type { Placements } from '@/lib/lab/types';

const full = () => placementsForSteps(lesson, lesson.steps.length);

describe('classroom engineering lab', () => {
  it('has the requested nine physical pieces and starts empty', () => {
    expect(totalPieces(lesson)).toBe(9);
    expect(simulate(lesson, {})).toMatchObject({ success: false, status: 'empty', moving: {} });
    expect(currentStep(lesson, {})?.slot).toBe('base');
  });

  it('rejects incompatible parts, missing supports, and wrong orientation', () => {
    expect(canPlace(lesson, {}, 'gear', 'base', 'flat')).toMatchObject({ ok: false, reason: 'wrong-part' });
    expect(canPlace(lesson, {}, 'axle', 'axle-L', 'through')).toMatchObject({ ok: false, reason: 'missing-dependency' });
    const p = placementsForSteps(lesson, 1);
    expect(canPlace(lesson, p, 'support', 'support-L', 'side')).toMatchObject({ ok: false, reason: 'wrong-orientation' });
    expect(Object.keys(p)).toEqual(['base']);
  });

  it('uses inventory and will not duplicate a placed piece', () => {
    const p = full();
    expect(remaining(lesson, p, 'support')).toBe(0);
    expect(placePart(lesson, p, 'support', 'support-F', 'up')).toMatchObject({ ok: false, reason: 'none-left' });
  });

  it('transmits opposite motion through meshing gears to the fan', () => {
    const p = full();
    const result = simulate(lesson, p);
    expect(result).toMatchObject({ success: true, status: 'success', axes: { L: 1, R: -1 } });
    expect(result.moving['crank-L']).toBe(1);
    expect(result.moving['gear-L']).toBe(1);
    expect(result.moving['gear-R']).toBe(-1);
    expect(result.moving['rotor-R']).toBe(-1);
    expect(result.moving.base).toBeUndefined();
    expect(currentStep(lesson, p)).toBeNull();
  });

  it('moves the input without a follower while the attached fan stays still', () => {
    const p = full();
    delete p['gear-R'];
    const result = simulate(lesson, p);
    expect(result.status).toBe('missing-follower');
    expect(result.moving['gear-L']).toBe(1);
    expect(result.moving['crank-L']).toBe(1);
    expect(result.moving['rotor-R']).toBeUndefined();
  });

  it('moves both gears when only the rotor is missing', () => {
    const p = full();
    delete p['rotor-R'];
    expect(simulate(lesson, p)).toMatchObject({ success: false, status: 'output-missing', axes: { L: 1, R: -1 } });
  });

  it('does not transmit motion across a gap', () => {
    const p = full();
    for (const part of ['support', 'axle', 'gear', 'rotor']) {
      p[`${part}-F`] = p[`${part}-R`];
      delete p[`${part}-R`];
    }
    expect(validatePlacements(lesson, p)).not.toBeNull();
    const result = simulate(lesson, p);
    expect(result.status).toBe('gears-not-meshed');
    expect(result.axes).toEqual({ L: 1 });
    expect(result.moving['rotor-F']).toBeUndefined();
  });

  it('requires crank input, not just a complete-looking gear train', () => {
    const p = full();
    delete p['crank-L'];
    expect(simulate(lesson, p)).toMatchObject({ success: false, status: 'no-input', moving: {} });
  });

  it('allows removal without corrupting history snapshots and protects dependents', () => {
    const p = full();
    expect(removePart(lesson, p, 'base').ok).toBe(false);
    const result = removePart(lesson, p, 'rotor-R');
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected removable rotor');
    expect(result.placements['rotor-R']).toBeUndefined();
    expect(p['rotor-R']).toBeDefined();
    expect(remaining(lesson, result.placements, 'rotor')).toBe(1);
  });

  it('restores valid progress regardless of serialization order', () => {
    const p = full();
    const reversed = Object.fromEntries(Object.entries(p).reverse());
    expect(validatePlacements(lesson, JSON.parse(JSON.stringify(reversed)))).toEqual(p);
  });

  it.each([null, [], 'bad', { base: null }, { base: { partId: 'base', orientation: 'up' } }, { bad: { partId: 'base', orientation: 'flat' } }, { 'gear-L': { partId: 'gear', orientation: 'flat' } }])('rejects damaged saved progress %#', (raw) => {
    expect(validatePlacements(lesson, raw)).toBeNull();
  });

  it('demo snapshots never mutate student progress', () => {
    const student: Placements = placementsForSteps(lesson, 3);
    const snapshot = JSON.stringify(student);
    for (let n = 0; n <= lesson.steps.length; n++) {
      expect(Object.keys(placementsForSteps(lesson, n))).toHaveLength(n);
    }
    expect(JSON.stringify(student)).toBe(snapshot);
  });
});
