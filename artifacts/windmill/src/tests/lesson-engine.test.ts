import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { addHint, createProgress, demoProgress, isComplete, motionAt, placeSet, reset, restoreProgress, testMotor, undo } from '../lib/lesson-engine.ts';
import { windmillLesson as lesson } from '../data/lessons/windmill.ts';

const build = () => {
  let p = createProgress(lesson);
  for (const step of lesson.steps) {
    const result = placeSet(lesson, p, step.partSetId, step.targetId);
    assert.equal(result.ok, true);
    p = result.progress;
  }
  return p;
};

describe('BC.013 configured lesson', () => {
  it('defines fourteen distinct stages, set identities and transmission reduction', () => {
    assert.equal(lesson.steps.length, 14);
    assert.equal(new Set(lesson.steps.map(s => s.id)).size, 14);
    assert.equal(new Set(lesson.steps.map(s => s.partSetId)).size, 14);
    assert.ok(lesson.transmission.driverTeeth > 0);
    assert.ok(lesson.transmission.drivenTeeth > lesson.transmission.driverTeeth);
  });
  it('starts with no construction and motor disabled', () => {
    const p = createProgress(lesson);
    assert.equal(p.placed.length, 0);
    assert.equal(isComplete(lesson, p), false);
    assert.equal(testMotor(lesson, p).ok, false);
    assert.equal(testMotor(lesson, p).remaining, 14);
  });
  it('rejects out-of-order pieces without changing saved state', () => {
    const p = createProgress(lesson);
    for (const step of lesson.steps.slice(1)) {
      const result = placeSet(lesson, p, step.partSetId, step.targetId);
      assert.equal(result.ok, false);
      assert.deepEqual(result.progress, p);
    }
  });
  it('rejects wrong targets and unknown sets', () => {
    const p = createProgress(lesson);
    assert.equal(placeSet(lesson, p, lesson.steps[0].partSetId, 'wrong-target').ok, false);
    assert.equal(placeSet(lesson, p, 'unknown-set', lesson.steps[0].targetId).ok, false);
  });
  it('advances one stage at a time and enables motor only after all fourteen', () => {
    let p = createProgress(lesson);
    lesson.steps.forEach((step, index) => {
      const before = JSON.stringify(p);
      const result = placeSet(lesson, p, step.partSetId, step.targetId);
      assert.equal(JSON.stringify(p), before, 'history remains immutable');
      p = result.progress;
      assert.equal(p.placed.length, index + 1);
      assert.equal(testMotor(lesson, p).ok, index === 13);
    });
    assert.equal(isComplete(lesson, p), true);
    assert.equal(placeSet(lesson, p, 'anything', 'anything').ok, false);
    assert.equal(testMotor(lesson, p).progress.tested, true);
  });
  it('undo invalidates completion and makes the removed set placeable again', () => {
    const complete = testMotor(lesson, build()).progress;
    const p = undo(complete);
    assert.equal(complete.placed.length, 14);
    assert.equal(p.placed.length, 13);
    assert.equal(p.tested, false);
    assert.equal(testMotor(lesson, p).ok, false);
    const last = lesson.steps[13];
    assert.equal(placeSet(lesson, p, last.partSetId, last.targetId).ok, true);
  });
  it('undo at zero is safe and reset preserves language only', () => {
    assert.deepEqual(undo(createProgress(lesson)), createProgress(lesson));
    const p = { ...addHint(build()), language: 'en' as const, tested: true };
    assert.deepEqual(reset(lesson, p), createProgress(lesson, 'en'));
  });
  it('restores progress, hints, language and test status after refresh', () => {
    const p = { ...addHint(testMotor(lesson, build()).progress), language: 'en' as const };
    assert.deepEqual(restoreProgress(lesson, JSON.stringify(p)), p);
    assert.equal(restoreProgress(lesson, JSON.stringify(createProgress(lesson, 'ar')))?.language, 'ar');
  });
  it('rejects corrupt, stale, skipped, duplicate or fabricated completed progress', () => {
    const p = createProgress(lesson);
    const invalid = [
      null, '{bad json', '[]', 'null',
      JSON.stringify({ ...p, version: -1 }),
      JSON.stringify({ ...p, lessonId: 'other' }),
      JSON.stringify({ ...p, language: 'fr' }),
      JSON.stringify({ ...p, placed: [lesson.steps[1].id] }),
      JSON.stringify({ ...p, placed: [lesson.steps[0].id, lesson.steps[0].id] }),
      JSON.stringify({ ...p, tested: true }),
      JSON.stringify({ ...p, hintsUsed: -1 }),
      JSON.stringify({ ...p, hintsUsed: 1.5 }),
    ];
    for (const raw of invalid) assert.equal(restoreProgress(lesson, raw), null);
  });
  it('demonstration construction is separate from the student and can move both ways', () => {
    const student = addHint(createProgress(lesson, 'en'));
    const snapshot = JSON.stringify(student);
    assert.equal(demoProgress(lesson, 0, student.language).placed.length, 0);
    assert.equal(demoProgress(lesson, 14, student.language).placed.length, 14);
    assert.equal(demoProgress(lesson, 4, student.language).placed.length, 4);
    assert.equal(demoProgress(lesson, -1, student.language).placed.length, 0);
    assert.equal(demoProgress(lesson, 99, student.language).placed.length, 14);
    assert.equal(JSON.stringify(student), snapshot);
  });
  it('meshed gears rotate opposite directions with a tooth-count-based speed ratio', () => {
    const motion = motionAt(lesson, 2, true);
    assert.ok(motion.driver > 0);
    assert.ok(motion.driven < 0);
    assert.ok(Math.abs(motion.driven) < motion.driver);
    assert.equal(motion.driven, -motion.driver * lesson.transmission.driverTeeth / lesson.transmission.drivenTeeth);
    assert.equal(motion.rotor, motion.driven);
    assert.equal(motion.axle, motion.driven);
    assert.equal(motion.motorOn, true);
    assert.equal(motionAt(lesson, 2, false).motorOn, false);
    assert.equal(motionAt(lesson, 2, false).driver, 0);
  });
});
