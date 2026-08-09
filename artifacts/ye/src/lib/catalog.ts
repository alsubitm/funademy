/**
 * Official FunAdemy catalog metadata (Master Spec, Aug 2026).
 * Three fields → seven programs. Keyed by program slug (DB source of truth
 * for names/ages; this file adds field grouping + fixed specs for display).
 */

export type FieldId = 'world' | 'mech' | 'code';

export const FIELDS: Record<FieldId, { ar: string; en: string; tint: string }> = {
  world: { ar: 'العالم من حولنا', en: 'The World Around Us', tint: '#FFCA17' },
  mech: { ar: 'الهندسة الميكانيكية', en: 'Mechanical Engineering', tint: '#E5AE4A' },
  code: { ar: 'البرمجة والروبوتات', en: 'Coding & Robotics', tint: '#1C54CB' },
};

export const CATALOG: Record<
  string,
  { field: FieldId; lessonMin: number; classCap: number; formatAr: string; formatEn: string }
> = {
  'big-builders': { field: 'world', lessonMin: 45, classCap: 12, formatAr: 'أونلاين', formatEn: 'Online' },
  'bricks-challenge': { field: 'mech', lessonMin: 75, classCap: 16, formatAr: 'أونلاين', formatEn: 'Online' },
  'galileo-technic': { field: 'mech', lessonMin: 75, classCap: 16, formatAr: 'أونلاين', formatEn: 'Online' },
  smartivo: { field: 'code', lessonMin: 45, classCap: 12, formatAr: 'أونلاين', formatEn: 'Online' },
  algoplay: { field: 'code', lessonMin: 75, classCap: 16, formatAr: 'أونلاين', formatEn: 'Online' },
  robotoys: { field: 'code', lessonMin: 90, classCap: 16, formatAr: 'أونلاين', formatEn: 'Online' },
  algoc: { field: 'code', lessonMin: 90, classCap: 8, formatAr: 'أونلاين', formatEn: 'Online' },
};

/** Learning-path order (age order, finish flag at AlgoC). */
export const PATH_ORDER = [
  'big-builders',
  'smartivo',
  'bricks-challenge',
  'algoplay',
  'galileo-technic',
  'robotoys',
  'algoc',
];
