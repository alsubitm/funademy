import { NextResponse } from 'next/server';
import type { Prisma, LiveLabRoom } from '@prisma/client';
import { prisma } from './db';
import { isAdminRequest } from './auth';
import { currentInstructor } from './instructor-auth';
import type { LiveQuestion, LiveRoom } from './live-lab-types';

export class LiveError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const reply = (value: unknown, status = 200) => NextResponse.json(value, {
  status, headers: { 'Cache-Control': 'private, no-store', 'Referrer-Policy': 'no-referrer' },
});
export function failure(error: unknown) {
  return reply({ error: error instanceof LiveError ? error.message : 'service_unavailable' },
    error instanceof LiveError ? error.status : 503);
}
export async function staff() {
  // Prefer explicit administrator authority when both staff cookies exist.
  if (await isAdminRequest()) return { role: 'admin' as const, id: null, version: null };
  const teacher = await currentInstructor();
  if (!teacher) throw new LiveError(401, 'unauthorized');
  return { role: 'instructor' as const, id: teacher.id, version: teacher.authVersion };
}
export type Staff = Awaited<ReturnType<typeof staff>>;
export async function lockTeacher(tx: Prisma.TransactionClient, actor: Staff, teacherId: number) {
  if (actor.role === 'instructor' && actor.id !== teacherId) throw new LiveError(403, 'forbidden');
  await tx.$queryRaw`SELECT id FROM ye_instructors WHERE id = ${teacherId} FOR UPDATE`;
  const teacher = await tx.instructor.findUnique({ where: { id: teacherId } });
  if (!teacher?.active || (actor.role === 'instructor' && teacher.authVersion !== actor.version)) {
    throw new LiveError(403, 'forbidden');
  }
  return teacher;
}
export async function roomTransaction<T>(actor: Staff, id: string, fn: (tx: Prisma.TransactionClient, room: LiveLabRoom) => Promise<T>) {
  return prisma.$transaction(async tx => {
    const first = await tx.liveLabRoom.findUnique({ where: { id } });
    if (!first) throw new LiveError(404, 'not_found');
    await lockTeacher(tx, actor, first.instructorId);
    await tx.$queryRaw`SELECT id FROM ye_live_lab_rooms WHERE id = ${id} FOR UPDATE`;
    const room = await tx.liveLabRoom.findUniqueOrThrow({ where: { id } });
    return fn(tx, room);
  }, { timeout: 30000, maxWait: 5000 });
}
export function roomWire(room: LiveLabRoom): LiveRoom {
  return {
    id: room.id, title: room.title, instructorId: room.instructorId,
    startsAt: room.startsAt.toISOString(), durationMin: room.durationMin,
    phase: room.phase as LiveRoom['phase'], step: room.step, motor: room.motor,
    speed: room.speed, reverse: room.reverse, version: room.version,
    meetUrl: room.meetUrl, calendarStatus: room.calendarStatus,
  };
}
export const questions: LiveQuestion[] = [
  { id: 'energy', en: 'What drives a real windmill?', ar: 'ما الذي يحرّك طاحونة الهواء الحقيقية؟',
    options: [{ en: 'Wind', ar: 'الرياح' }, { en: 'Paint', ar: 'الطلاء' }, { en: 'The base alone', ar: 'القاعدة وحدها' }] },
  { id: 'gears', en: 'Two meshing gears turn in…', ar: 'يدور ترسان متشابكان في…',
    options: [{ en: 'The same direction', ar: 'الاتجاه نفسه' }, { en: 'Opposite directions', ar: 'اتجاهين متعاكسين' }, { en: 'Neither direction', ar: 'لا يدوران' }] },
  { id: 'ratio', en: 'In our illustrative 12:36 example, the larger driven gear turns…', ar: 'في مثالنا التوضيحي 12:36، يدور الترس الكبير المُدار…',
    options: [{ en: 'Faster', ar: 'أسرع' }, { en: 'At the same speed', ar: 'بالسرعة نفسها' }, { en: 'Slower', ar: 'أبطأ' }] },
  { id: 'stability', en: 'Why build a stable base?', ar: 'لماذا نبني قاعدة ثابتة؟',
    options: [{ en: 'To support the moving structure', ar: 'لدعم الهيكل المتحرك' }, { en: 'To stop all gears', ar: 'لإيقاف كل التروس' }, { en: 'Only for decoration', ar: 'للزينة فقط' }] },
  { id: 'safety', en: 'Before adjusting the gears, you should…', ar: 'قبل تعديل التروس يجب أن…',
    options: [{ en: 'Speed up the motor', ar: 'تزيد سرعة المحرك' }, { en: 'Stop the motor', ar: 'توقف المحرك' }, { en: 'Hold the moving blades', ar: 'تمسك الشفرات المتحركة' }] },
];
// Answer key is server-only; never serialize it with questions.
const key = [0, 1, 2, 0, 1];
export function grade(answers: unknown): { answers: number[]; score: number } {
  if (!Array.isArray(answers) || answers.length !== key.length ||
    answers.some((a, i) => !Number.isInteger(a) || a < 0 || a >= questions[i].options.length)) {
    throw new LiveError(400, 'invalid_answers');
  }
  return { answers, score: answers.reduce((sum, answer, i) => sum + Number(answer === key[i]), 0) };
}
export function unexpired(room: LiveLabRoom) {
  return Date.now() <= room.startsAt.getTime() + (room.durationMin + 24 * 60) * 60000;
}
export function validId(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value);
}
