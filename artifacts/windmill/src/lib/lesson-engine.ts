export type Language = 'ar' | 'en';
export interface StepRule { id: string; partSetId: string; targetId: string }
export interface LessonRules {
  id: string;
  version: number;
  steps: readonly StepRule[];
  transmission: { driverTeeth: number; drivenTeeth: number; driverRpm: number };
}
export interface Progress {
  lessonId: string;
  version: number;
  language: Language;
  placed: string[];
  hintsUsed: number;
  tested: boolean;
}
export function createProgress(lesson: LessonRules, language: Language = 'ar'): Progress {
  return { lessonId: lesson.id, version: lesson.version, language, placed: [], hintsUsed: 0, tested: false };
}
export const isComplete = (lesson: LessonRules, p: Progress) =>
  p.placed.length === lesson.steps.length && lesson.steps.every((s, i) => p.placed[i] === s.id);
export function placeSet(lesson: LessonRules, p: Progress, partSetId: string, targetId: string):
  { ok: true; progress: Progress } | { ok: false; reason: 'complete' | 'wrong-set' | 'wrong-target'; progress: Progress } {
  const step = lesson.steps[p.placed.length];
  if (!step) return { ok: false, reason: 'complete', progress: p };
  if (partSetId !== step.partSetId) return { ok: false, reason: 'wrong-set', progress: p };
  if (targetId !== step.targetId) return { ok: false, reason: 'wrong-target', progress: p };
  return { ok: true, progress: { ...p, placed: [...p.placed, step.id], tested: false } };
}
export const undo = (p: Progress): Progress => ({ ...p, placed: p.placed.slice(0, -1), tested: false });
export const reset = (lesson: LessonRules, p: Progress) => createProgress(lesson, p.language);
export const addHint = (p: Progress): Progress => ({ ...p, hintsUsed: p.hintsUsed + 1 });
export function testMotor(lesson: LessonRules, p: Progress): { ok: boolean; remaining: number; progress: Progress } {
  const ok = isComplete(lesson, p);
  return { ok, remaining: Math.max(0, lesson.steps.length - p.placed.length), progress: { ...p, tested: ok } };
}
export function demoProgress(lesson: LessonRules, count: number, language: Language): Progress {
  const n = Math.max(0, Math.min(lesson.steps.length, Math.trunc(count)));
  return { ...createProgress(lesson, language), placed: lesson.steps.slice(0, n).map(s => s.id) };
}
/** Angular relationship is driven by the configured tooth counts, not independent animation loops. */
export function motionAt(lesson: LessonRules, seconds: number, running: boolean) {
  const driver = running ? seconds * lesson.transmission.driverRpm * 6 : 0;
  const driven = -driver * lesson.transmission.driverTeeth / lesson.transmission.drivenTeeth;
  return { driver, driven, axle: driven, rotor: driven, motorOn: running };
}
/** Fail closed on corrupt/stale state or skipped construction steps. */
export function restoreProgress(lesson: LessonRules, raw: string | null): Progress | null {
  if (!raw) return null;
  try {
    const p: unknown = JSON.parse(raw);
    if (!p || typeof p !== 'object') return null;
    const s = p as Progress;
    if (s.lessonId !== lesson.id || s.version !== lesson.version || !['ar', 'en'].includes(s.language)) return null;
    if (!Array.isArray(s.placed) || s.placed.length > lesson.steps.length ||
      s.placed.some((id, i) => id !== lesson.steps[i].id)) return null;
    if (!Number.isSafeInteger(s.hintsUsed) || s.hintsUsed < 0 || typeof s.tested !== 'boolean') return null;
    if (s.tested && !isComplete(lesson, s)) return null;
    return { lessonId: s.lessonId, version: s.version, language: s.language, placed: [...s.placed], hintsUsed: s.hintsUsed, tested: s.tested };
  } catch { return null; }
}

// Backups contain only the engine's allowlisted lesson state, never device metadata.
export const MAX_BACKUP_BYTES = 16 * 1024;
export function exportProgress(lesson: LessonRules, progress: Progress): string {
  const clean = restoreProgress(lesson, JSON.stringify(progress));
  if (!clean) throw new Error('Invalid lesson progress');
  return JSON.stringify({ format: 'windmill-progress', backupVersion: 1, progress: clean }, null, 2);
}
export function importProgress(lesson: LessonRules, raw: string): Progress | null {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) return null;
  try {
    const backup = JSON.parse(raw);
    if (!backup || backup.format !== 'windmill-progress' || backup.backupVersion !== 1) return null;
    return restoreProgress(lesson, JSON.stringify(backup.progress));
  } catch { return null; }
}
