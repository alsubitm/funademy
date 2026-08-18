/**
 * Program Course JSON-LD structured data — slot-schedule and courseMode guards.
 *
 * Verifies that both AR and EN program page files:
 * 1. Use `slot.format` (not `program.format`) for each per-slot CourseInstance.courseMode.
 * 2. Include a `courseSchedule` block with `byDay` (Schema.org URI) and `startTime`
 *    drawn from slot fields — so crawlers can read actual schedule data.
 * 3. Emit `hasCourseInstance` on the Course schema — required for Google Course
 *    rich results.
 *
 * Why source-scan rather than render: the pages are async Server Components that
 * depend on a live DB (via prisma / safeQuery). Mocking the full Next.js + Prisma
 * stack is disproportionate for structural assertions. Source-scan tests have
 * proven reliable for this project (see globals-css-guard.test.ts).
 */

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '..');

const PROGRAM_PAGES = [
  'app/(ar)/programs/[slug]/page.tsx',
  'app/en/programs/[slug]/page.tsx',
] as const;

describe('Course JSON-LD: hasCourseInstance is emitted', () => {
  for (const rel of PROGRAM_PAGES) {
    it(`${rel} includes hasCourseInstance`, () => {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      expect(src).toContain('hasCourseInstance');
    });
  }
});

describe('Course JSON-LD: courseMode uses slot.format, not program.format', () => {
  for (const rel of PROGRAM_PAGES) {
    it(`${rel} derives courseMode from slot.format`, () => {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      // The per-slot mapping must use slot.format for courseMode
      expect(src).toContain("slot.format === 'online'");
    });

    it(`${rel} slot.map callback uses slot.format, not program.format`, () => {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      // Extract the slot.map callback: from "program.slots.map(slot" to the
      // closing "}))". The source reads: program.slots.map(slot => ({...}))
      const mapStart = src.indexOf('program.slots.map(slot');
      expect(mapStart).toBeGreaterThan(-1);
      // "}))": closes slot => ({...}) then .map(...)
      const mapEnd = src.indexOf('}))' , mapStart);
      expect(mapEnd).toBeGreaterThan(mapStart);
      const mapBlock = src.slice(mapStart, mapEnd);
      expect(mapBlock).toContain('slot.format');
      // The fallback array (no slots) legitimately uses program.format — it
      // must not appear inside the per-slot .map() callback, only after it.
      expect(mapBlock).not.toContain('program.format');
    });
  }
});

describe('Course JSON-LD: courseSchedule carries byDay and startTime', () => {
  for (const rel of PROGRAM_PAGES) {
    it(`${rel} emits courseSchedule`, () => {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      // Key is unquoted in the object literal: "courseSchedule:"
      expect(src).toContain('courseSchedule:');
    });

    it(`${rel} courseSchedule uses Schema.org byDay URI from slot.weekday`, () => {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      expect(src).toContain('https://schema.org/');
      expect(src).toContain('slot.weekday');
    });

    it(`${rel} courseSchedule includes slot.time as startTime`, () => {
      const src = readFileSync(path.join(SRC, rel), 'utf8');
      expect(src).toContain('slot.time');
      expect(src).toContain('startTime:');
    });
  }
});
