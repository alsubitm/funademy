import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { advanceDriverAngle, transmissionMotion } from '../lib/motor-controls.ts';

describe('interactive motor controls', () => {
  it('integrates speed without changing the existing shaft position', () => {
    const initial = advanceDriverAngle(0, 1, 30, 1, 1);
    assert.equal(initial, 180);
    assert.equal(advanceDriverAngle(initial, 0, 30, 2, 1), initial);
    assert.equal(advanceDriverAngle(initial, 1, 30, 2, 1), 540);
  });
  it('reverses continuously and slow motion scales subsequent increments', () => {
    assert.equal(advanceDriverAngle(180, .5, 30, 1, -1), 90);
    assert.equal(advanceDriverAngle(180, 1, 30, .25, 1), 225);
  });
  it('preserves every angle on pause and resumes from that angle', () => {
    const paused = transmissionMotion(135, 12, 36, false);
    assert.deepEqual(paused, {driver:135, driven:-45, axle:-45, rotor:-45, motorOn:false});
    assert.equal(advanceDriverAngle(paused.driver, 0, 30, 1, 1), 135);
    assert.equal(advanceDriverAngle(135, 1, 30, 0, 1), 135);
  });
  it('keeps gear, axle and blades synchronized in both directions', () => {
    for (const direction of [1, -1] as const) {
      const motion = transmissionMotion(advanceDriverAngle(0, 1, 30, 1, direction), 12, 36, true);
      assert.equal(motion.driven, -motion.driver / 3);
      assert.equal(motion.axle, motion.driven);
      assert.equal(motion.rotor, motion.driven);
    }
  });
  it('supports equal and swapped experimental ratios', () => {
    assert.equal(transmissionMotion(180, 12, 12, true).driven, -180);
    assert.equal(transmissionMotion(180, 36, 12, true).driven, -540);
  });
  it('rejects invalid controls and gear sizes instead of rendering NaN', () => {
    assert.throws(() => advanceDriverAngle(0, -1, 30, 1, 1), RangeError);
    assert.throws(() => advanceDriverAngle(0, 1, 30, NaN, 1), RangeError);
    assert.throws(() => transmissionMotion(0, 0, 36, true), RangeError);
    assert.throws(() => transmissionMotion(0, 12, 1.5, true), RangeError);
  });
});
