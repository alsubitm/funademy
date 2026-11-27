import { describe, expect, it } from 'vitest';
import { refreshNote, type NoteState } from '@/components/instructor/note-state';

const v1 = '2026-11-13T12:00:00.001Z';
const v2 = '2026-11-13T12:00:00.002Z';
const draft: NoteState = { draft: 'local draft', base: 'original', version: v1, status: 'idle' };

describe('private note draft refresh', () => {
  it('keeps the original base and version when another device saves', () => {
    const result = refreshNote(draft, { text: 'other device', version: v2 });
    expect(result).toEqual({ ...draft, status: 'conflict', conflict: { text: 'other device', version: v2 }, error: undefined });
    expect(refreshNote(result, { text: 'other device', version: v2 }).draft).toBe('local draft');
  });
  it('detects first-creation and same-text revision conflicts', () => {
    expect(refreshNote({ ...draft, base: '', version: null }, { text: 'created elsewhere', version: v1 }).status).toBe('conflict');
    expect(refreshNote(draft, { text: 'original', version: v2 }).status).toBe('conflict');
  });
  it('refreshes clean notes but never changes an in-flight save or adopts an older response', () => {
    expect(refreshNote({ ...draft, draft: draft.base }, { text: 'new', version: v2 }).draft).toBe('new');
    expect(refreshNote({ ...draft, status: 'saving' }, { text: 'new', version: v2 }).status).toBe('saving');
    expect(refreshNote({ ...draft, version: v2 }, { text: 'old', version: v1 }).version).toBe(v2);
    expect(refreshNote({ ...draft, draft: draft.base, version: v2 }, { text: '', version: null }).version).toBe(v2);
  });
  it('retains failed drafts and initializes a new viewer only from their own data', () => {
    expect(refreshNote({ ...draft, status: 'error', error: 'offline' }, { text: 'original', version: v1 }).draft).toBe('local draft');
    expect(refreshNote(undefined, { text: '', version: null })).toEqual({ draft: '', base: '', version: null, status: 'idle', savedAt: undefined });
  });
});
