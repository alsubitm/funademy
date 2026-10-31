import { describe, expect, it } from 'vitest';
import { validEnglishOptions, hasEnglishOptions, optionLabel } from '@/lib/learning-options';
import { gradeAnswers } from '@/lib/learning';
import fs from 'node:fs';
import path from 'node:path';

describe('English learning choices', () => {
  const options = ['أحمر', 'أزرق'];
  const optionsEn = ['Red', 'Blue'];
  it('uses English labels without changing the canonical answer', () => {
    expect(optionLabel(options, optionsEn, 1, true)).toBe('Blue');
    expect(optionLabel(options, optionsEn, 1, false)).toBe('أزرق');
    const result = gradeAnswers(
      [{ id: 1, correctAnswer: options[1] }],
      [{ exerciseId: 1, answer: options[1] }],
    );
    expect(result.score).toBe(100);
  });
  it('rejects mismatched, blank or non-string translations', () => {
    expect(validEnglishOptions(['Red'], options)).toBe(false);
    expect(validEnglishOptions(['Red', ' '], options)).toBe(false);
    expect(validEnglishOptions([1, 2], options)).toBe(false);
    expect(validEnglishOptions(optionsEn, options)).toBe(true);
    expect(validEnglishOptions([], options)).toBe(true);
  });
  it('does not send an English learner into untranslated Arabic choices', () => {
    expect(hasEnglishOptions(options, [])).toBe(false);
    expect(hasEnglishOptions(['1', '2'], [])).toBe(true);
    expect(hasEnglishOptions(options, optionsEn)).toBe(true);
  });
});

describe('shared learning routes', () => {
  const root = path.resolve('src/app');
  it.each([
    '[childId]/layout.tsx',
    '[childId]/page.tsx',
    '[childId]/search/page.tsx',
    '[childId]/subjects/[slug]/page.tsx',
    '[childId]/lessons/[id]/page.tsx',
  ])('English %s uses the same component as Arabic', route => {
    const source = fs.readFileSync(path.join(root, 'en/learn', route), 'utf8');
    expect(source).toContain(`@/app/(ar)/learn/${route.replace(/\.tsx$/, '')}`);
  });
  it('keeps lesson drafts locale-independent and submits canonical option values', () => {
    const source = fs.readFileSync(path.join(root, '(ar)/learn/[childId]/lessons/[id]/page.tsx'), 'utf8');
    expect(source).toContain('funademy:lesson-draft:${childId}:${id}');
    expect(source).toContain('handleOption(opt)');
    expect(source).toContain('optionLabel(');
    expect(source).toContain('/svc/learn/lessons/${id}/complete');
  });
});
