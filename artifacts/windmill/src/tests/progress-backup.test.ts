import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, demoProgress, exportProgress, importProgress, MAX_BACKUP_BYTES } from '../lib/lesson-engine.ts';
import { windmillLesson as lesson } from '../data/lessons/windmill.ts';

describe('anonymous progress backups', () => {
  it('round trips empty, partial and tested progress in both languages', () => {
    for (const language of ['ar', 'en'] as const) {
      for (const count of [0, 5, lesson.steps.length]) {
        const p = { ...demoProgress(lesson, count, language), hintsUsed: 3, tested: count === lesson.steps.length };
        assert.deepEqual(importProgress(lesson, exportProgress(lesson, p)), p);
      }
    }
  });
  it('strips unrecognized fields on both export and import', () => {
    const p = createProgress(lesson);
    const raw = exportProgress(lesson, { ...p, deviceName: 'do not retain' } as typeof p);
    assert.ok(!raw.includes('deviceName'));
    const parsed = JSON.parse(raw);
    parsed.progress.name = 'do not retain';
    parsed.deviceId = 'do not retain';
    assert.deepEqual(importProgress(lesson, JSON.stringify(parsed)), p);
    assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['backupVersion', 'format', 'progress']);
  });
  it('rejects corrupt, foreign, stale, out-of-order and impossible progress', () => {
    const p = createProgress(lesson);
    const wrap = (progress: unknown) => JSON.stringify({ format: 'windmill-progress', backupVersion: 1, progress });
    for (const raw of [
      '', '{', 'null', '[]', JSON.stringify(p),
      ' '.repeat(MAX_BACKUP_BYTES + 1),
      JSON.stringify({ format: 'other', backupVersion: 1, progress: p }),
      JSON.stringify({ format: 'windmill-progress', backupVersion: 2, progress: p }),
      ...[
        { lessonId: 'other' }, { version: lesson.version + 1 }, { language: 'fr' },
        { placed: [lesson.steps[1].id] }, { hintsUsed: -1 }, { hintsUsed: 1.5 }, { tested: true },
      ].map(change => wrap({ ...p, ...change })),
    ]) assert.equal(importProgress(lesson, raw), null, raw.slice(0, 100));
    assert.throws(() => exportProgress(lesson, { ...p, tested: true }));
  });
});
