---
name: YE learning platform
description: Durable access, security, and atomicity decisions for the kids learning platform in artifacts/ye.
---

## Access rules (confirmed with user)
- Family gate: `ye_family` cookie + at least one `active` enrollment for any student in the family.
- Kid gate: `ye_kid` cookie (24h TTL, set by PIN verify); required on all lesson routes.
- Content gate: lesson and unit must be published and band must match `child.band`.
- Prerequisite lock: all lower-position units in same band+subject must be fully **first-completed** (use `LrnFirstCompletion`, not `LrnCompletion`) before the current unit is accessible.
- Daily time limit: enforced server-side using `lesson.durationMinutes` (server-trusted), never client-supplied `timeSpentSeconds`.

## Atomicity rules
All reward state is updated inside a single `$transaction` that locks the child row via `SELECT … FOR UPDATE`. This serializes concurrent completions for the same child — including different lessons — so:
1. Daily limit re-check happens inside the lock (post-lock data is authoritative).
2. XP/streak/badges are computed from the fresh locked child state, never from a pre-transaction snapshot.
3. `LrnFirstCompletion.createMany({ skipDuplicates: true })` is the idempotency gate; `count === 1` means first completion, `0` means repeat.

**Why:** Without the row lock, concurrent completions of different lessons can (a) both pass the daily limit pre-check and each insert a completion that together exceeds it, and (b) both read the same stale XP and overwrite each other's awards.

## Answer-key security
`correctAnswer` is never included in lesson GET responses. Grading is server-only; `gradeAnswers()` returns `{ score, perAnswer }` which the completion POST returns to the client. The client uses `perAnswer` (server-computed) to show per-exercise feedback in the reward stage.

## Seeded exercise types
Only `multiple_choice`, `fill_blank`, and `picture_select` are seeded. The `matching` type is in the schema for future use but not seeded (matching UI is not yet implemented).

## Kid profile model
`LrnChild` is standalone — linked to `Family`, not to `Student`. Access gating is family-level.

## Content source for seeding
`ye_lrn_*` content tables started EMPTY. The old Manara curriculum (4 subjects, 12 units, 48 lessons, 240 exercises) is preserved PII-free in `backups/manara-learning-content-2026-08-09.sql` (old `public.subjects/units/lessons/exercises` shape — needs mapping into the `ye_lrn_*` schema when importing). The orphan Manara/live-sessions tables themselves were dropped from the dev DB Aug 9, 2026; never re-create them.

## English curriculum policy
Do not silently substitute Arabic curriculum for missing English translations or automatically translate graded answer values. Missing English lesson text should be explicit; authors supply translations.

**Why:** An English interface must not send families into an unintelligible exercise, and machine-translated answer values could change grading or invalidate saved answers when switching language.

**How to apply:** Keep display translations separate from canonical answers and retain the same child session, draft identity, and grading service across locales. Treat video language and teaching-content quality as editorial work, not a claim that translating controls translates the media.
