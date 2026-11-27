export type SavedNote = { text: string; version: string | null };
export type NoteState = {
  draft: string; base: string; version: string | null;
  status: 'idle' | 'saving' | 'saved' | 'error' | 'conflict';
  error?: string; savedAt?: string; conflict?: SavedNote;
};

export function refreshNote(previous: NoteState | undefined, saved: SavedNote): NoteState {
  // A refresh must never rebase a dirty draft without the teacher's consent.
  if (previous) {
    if (previous.status === 'saving') return previous;
    if (previous.version && (!saved.version || previous.version > saved.version)) return previous;
    if (previous.draft !== previous.base || previous.conflict) {
      return previous.version === saved.version ? previous :
        { ...previous, status: 'conflict', conflict: saved, error: undefined };
    }
  }
  return { draft: saved.text, base: saved.text, version: saved.version,
    status: previous?.status === 'saved' ? 'saved' : 'idle', savedAt: saved.version ?? undefined };
}
