import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { chatExpiry } from '@/lib/chat-auth';
import { consultAvailability, nextOccurrence } from '@/lib/appointments';
import { createConsultation, createTrialBooking } from '@/lib/chat-booking';

export const prepareActionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('request_makeup'),
    studentId: z.number().int().positive(),
    sessionId: z.number().int().positive(),
    note: z.string().trim().max(300).optional(),
    idempotencyKey: z.string().min(8).max(120),
  }).strict(),
  z.object({
    kind: z.literal('book_consultation'),
    startsAt: z.string().datetime(),
    notes: z.string().trim().max(500).optional(),
    idempotencyKey: z.string().min(8).max(120),
  }).strict(),
  z.object({
    kind: z.literal('book_trial'),
    studentId: z.number().int().positive(),
    programId: z.number().int().positive(),
    slotId: z.number().int().positive(),
    idempotencyKey: z.string().min(8).max(120),
  }).strict(),
]);

export type PreparedInput = z.infer<typeof prepareActionSchema>;

export async function accountSummary(familyId: number) {
  const family = await prisma.family.findUnique({
    where: { id: familyId },
    select: {
      parentName: true,
      locale: true,
      phone: true,
      students: {
        select: {
          id: true,
          firstName: true,
          birthYear: true,
          enrollments: {
            where: { status: { in: ['active', 'pending'] } },
            select: {
              id: true,
              status: true,
              paidThrough: true,
              courseRun: {
                select: {
                  titleAr: true,
                  titleEn: true,
                  program: { select: { nameAr: true, nameEn: true } },
                  sessions: {
                    where: { date: { gte: new Date() }, status: 'scheduled' },
                    select: { id: true, date: true, status: true },
                    orderBy: { date: 'asc' },
                    take: 5,
                  },
                },
              },
            },
          },
          makeupRequests: {
            select: {
              id: true,
              status: true,
              createdAt: true,
              session: { select: { date: true, courseRun: { select: { program: { select: { nameAr: true, nameEn: true } } } } } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      },
      payments: { select: { id: true, kind: true, status: true, totalSar: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 10 },
    },
  });
  if (!family) return null;
  const local = family.phone.replace(/^\+966/, '0');
  const bookings = await prisma.booking.findMany({
    where: { phone: { in: [family.phone, local, family.phone.replace(/^\+/, '')] } },
    select: {
      id: true,
      status: true,
      trialStartsAt: true,
      childFirstName: true,
      program: { select: { nameAr: true, nameEn: true } },
      slot: { select: { format: true, location: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  return { ...family, bookings };
}

export function formatAccountSummary(
  account: NonNullable<Awaited<ReturnType<typeof accountSummary>>>,
  locale: 'ar' | 'en',
) {
  const ar = locale === 'ar';
  const lines: string[] = [ar ? `ملخص حساب ${account.parentName}:` : `Account summary for ${account.parentName}:`];
  if (!account.students.length) lines.push(ar ? '• لا يوجد أطفال مسجلون.' : '• No children are registered.');
  for (const child of account.students) {
    lines.push(`• ${child.firstName} (${child.birthYear})`);
    for (const enrollment of child.enrollments) {
      const program = ar ? enrollment.courseRun.program.nameAr : enrollment.courseRun.program.nameEn;
      const paid = enrollment.paidThrough ? enrollment.paidThrough.toISOString().slice(0, 10) : (ar ? 'غير محدد' : 'not set');
      lines.push(ar
        ? `  - ${program}: ${enrollment.status}، الاشتراك حتى ${paid}`
        : `  - ${program}: ${enrollment.status}, subscribed through ${paid}`);
      for (const session of enrollment.courseRun.sessions.slice(0, 3)) {
        lines.push(ar
          ? `    موعد قادم: ${session.date.toISOString()}`
          : `    Upcoming class: ${session.date.toISOString()}`);
      }
    }
    for (const request of child.makeupRequests.slice(0, 3)) {
      lines.push(ar
        ? `  - طلب تعويض ${request.status} (${request.session.date.toISOString().slice(0, 10)})`
        : `  - Makeup request ${request.status} (${request.session.date.toISOString().slice(0, 10)})`);
    }
  }
  for (const booking of account.bookings.slice(0, 5)) {
    const name = ar ? booking.program.nameAr : booking.program.nameEn;
    lines.push(ar
      ? `• حجز ${booking.childFirstName} في ${name}: ${booking.status}${booking.trialStartsAt ? ` — ${booking.trialStartsAt.toISOString()}` : ''}`
      : `• ${booking.childFirstName}'s booking for ${name}: ${booking.status}${booking.trialStartsAt ? ` — ${booking.trialStartsAt.toISOString()}` : ''}`);
  }
  for (const payment of account.payments.slice(0, 5)) {
    lines.push(ar
      ? `• دفعة ${payment.totalSar} ر.س — ${payment.status} (${payment.createdAt.toISOString().slice(0, 10)})`
      : `• Payment SAR ${payment.totalSar} — ${payment.status} (${payment.createdAt.toISOString().slice(0, 10)})`);
  }
  lines.push(ar ? 'إدارة الحساب: /account' : 'Manage account: /en/account');
  return lines.join('\n');
}

export async function prepareChatAction(conversationId: string, familyId: number, input: PreparedInput) {
  const existing = await prisma.chatActionAudit.findUnique({ where: { idempotencyKey: input.idempotencyKey } });
  if (existing) {
    if (existing.conversationId !== conversationId || existing.familyId !== familyId || existing.kind !== input.kind) {
      throw new Error('idempotency_conflict');
    }
    return existing;
  }

  let actionPayload: Record<string, unknown>;
  if (input.kind === 'request_makeup') {
    const attendance = await prisma.attendance.findFirst({
      where: {
        studentId: input.studentId,
        sessionId: input.sessionId,
        student: { familyId },
        status: { in: ['absent', 'excused'] },
      },
    });
    if (!attendance) throw new Error('not_missed_or_not_owned');
    actionPayload = { studentId: input.studentId, sessionId: input.sessionId, ...(input.note ? { note: input.note } : {}) };
  } else if (input.kind === 'book_consultation') {
    const available = await consultAvailability();
    if (!available.some((s) => s.startsAt === new Date(input.startsAt).toISOString())) throw new Error('slot_unavailable');
    actionPayload = { startsAt: new Date(input.startsAt).toISOString(), ...(input.notes ? { notes: input.notes } : {}) };
  } else {
    const [student, slot] = await Promise.all([
      prisma.student.findFirst({ where: { id: input.studentId, familyId } }),
      prisma.scheduleSlot.findFirst({ where: { id: input.slotId, programId: input.programId, active: true, seatsLeft: { gt: 0 } } }),
    ]);
    if (!student) throw new Error('student_not_owned');
    if (!slot) throw new Error('slot_unavailable');
    actionPayload = {
      studentId: input.studentId,
      programId: input.programId,
      slotId: input.slotId,
      trialStartsAt: nextOccurrence(slot.weekday, slot.time).toISOString(),
    };
  }

  return prisma.chatActionAudit.create({
    data: {
      conversationId,
      familyId,
      kind: input.kind,
      idempotencyKey: input.idempotencyKey,
      payload: actionPayload as Prisma.InputJsonValue,
      expiresAt: chatExpiry(),
    },
  });
}

export async function confirmChatAction(id: string, conversationId: string, familyId: number) {
  const changed = await prisma.chatActionAudit.updateMany({
    where: { id, conversationId, familyId, status: 'prepared', expiresAt: { gt: new Date() } },
    data: { status: 'confirmed', confirmedAt: new Date() },
  });
  if (!changed.count) {
    const action = await prisma.chatActionAudit.findFirst({ where: { id, conversationId, familyId } });
    if (action?.status === 'confirmed' || action?.status === 'succeeded') return action;
    throw new Error('action_not_confirmable');
  }
  return prisma.chatActionAudit.findUniqueOrThrow({ where: { id } });
}

type MakeupPayload = { studentId: number; sessionId: number; note?: string };
type ConsultPayload = { startsAt: string; notes?: string };
type TrialPayload = { studentId: number; programId: number; slotId: number; trialStartsAt?: string };

const EXECUTION_LEASE_MS = 2 * 60_000;

async function reconcileAction(
  action: Awaited<ReturnType<typeof prisma.chatActionAudit.findFirst>> & {},
  familyId: number,
): Promise<Prisma.InputJsonValue | null> {
  if (!action) return null;
  if (action.kind === 'request_makeup') {
    const p = action.payload as MakeupPayload;
    const request = await prisma.makeupRequest.findFirst({
      where: { studentId: p.studentId, sessionId: p.sessionId, student: { familyId } },
    });
    return request ? { requestId: request.id, status: request.status, reconciled: true } : null;
  }
  const family = await prisma.family.findUnique({ where: { id: familyId } });
  if (!family) throw new Error('family_not_found');
  if (action.kind === 'book_consultation') {
    const p = action.payload as ConsultPayload;
    const startsAt = new Date(p.startsAt);
    const appointment = await prisma.appointment.findFirst({
      where: { kind: 'consult', consultKey: startsAt.toISOString(), startsAt, phone: family.phone },
    });
    return appointment ? {
      appointmentId: appointment.id,
      startsAt: appointment.startsAt.toISOString(),
      meetUrl: appointment.meetUrl,
      calendarDegraded: !appointment.calendarEventId,
      reconciled: true,
    } : null;
  }
  const p = action.payload as TrialPayload;
  const student = await prisma.student.findFirst({ where: { id: p.studentId, familyId } });
  if (!student) throw new Error('student_not_owned');
  let startsAt = p.trialStartsAt ? new Date(p.trialStartsAt) : null;
  if (!startsAt) {
    const slot = await prisma.scheduleSlot.findUnique({ where: { id: p.slotId } });
    if (!slot) return null;
    startsAt = nextOccurrence(slot.weekday, slot.time);
  }
  const booking = await prisma.booking.findFirst({
    where: {
      phone: family.phone,
      childFirstName: student.firstName,
      childBirthYear: student.birthYear,
      programId: p.programId,
      slotId: p.slotId,
      trialStartsAt: startsAt,
    },
  });
  if (!booking) return null;
  const appointment = await prisma.appointment.findFirst({ where: { kind: 'trial', bookingId: booking.id } });
  return {
    bookingId: booking.id,
    status: booking.status,
    appointmentId: appointment?.id ?? null,
    calendarDegraded: !appointment?.calendarEventId,
    reconciled: true,
  };
}

export async function executeChatAction(id: string, conversationId: string, familyId: number) {
  const current = await prisma.chatActionAudit.findFirst({ where: { id, conversationId, familyId } });
  if (!current) throw new Error('action_not_found');
  if (current.status === 'succeeded') return current;
  if (current.status !== 'confirmed' && current.status !== 'executing') throw new Error('action_not_executable');
  if (
    current.status === 'executing' &&
    current.kind === 'book_trial' &&
    !(current.payload as TrialPayload).trialStartsAt
  ) {
    await prisma.chatActionAudit.update({
      where: { id },
      data: { status: 'failed', errorCode: 'execution_outcome_uncertain', executedAt: new Date() },
    });
    const open = await prisma.chatEscalation.findFirst({ where: { conversationId, reason: 'action_outcome_uncertain', status: 'open' } });
    if (!open) await prisma.chatEscalation.create({
      data: { conversationId, reason: 'action_outcome_uncertain', summary: 'Action outcome requires review', expiresAt: chatExpiry() },
    });
    throw new Error('execution_outcome_uncertain');
  }
  const leaseIsStale = !current.executionStartedAt || current.executionStartedAt.getTime() <= Date.now() - EXECUTION_LEASE_MS;
  if (current.status === 'executing' && leaseIsStale && current.executionAttempts >= 2) {
    await prisma.chatActionAudit.update({
      where: { id },
      data: { status: 'failed', errorCode: 'execution_outcome_uncertain', executedAt: new Date() },
    });
    const open = await prisma.chatEscalation.findFirst({ where: { conversationId, reason: 'action_outcome_uncertain', status: 'open' } });
    if (!open) await prisma.chatEscalation.create({
      data: { conversationId, reason: 'action_outcome_uncertain', summary: 'Action outcome requires review', expiresAt: chatExpiry() },
    });
    throw new Error('execution_outcome_uncertain');
  }
  const reconciled = await reconcileAction(current, familyId);
  if (reconciled) {
    return prisma.chatActionAudit.update({
      where: { id },
      data: { status: 'succeeded', result: reconciled, executedAt: new Date(), errorCode: null },
    });
  }
  const now = new Date();
  const staleBefore = new Date(now.getTime() - EXECUTION_LEASE_MS);
  const claim = await prisma.chatActionAudit.updateMany({
    where: {
      id,
      conversationId,
      familyId,
      expiresAt: { gt: now },
      OR: [
        { status: 'confirmed' },
        { status: 'executing', executionAttempts: { lt: 2 }, OR: [{ executionStartedAt: null }, { executionStartedAt: { lte: staleBefore } }] },
      ],
    },
    data: { status: 'executing', executionStartedAt: now, executionAttempts: { increment: 1 } },
  });
  if (!claim.count) throw new Error('action_not_executable');

  try {
    let result: Prisma.InputJsonValue;
    if (current.kind === 'request_makeup') {
      const p = current.payload as MakeupPayload;
      const attendance = await prisma.attendance.findFirst({
        where: { studentId: p.studentId, sessionId: p.sessionId, student: { familyId }, status: { in: ['absent', 'excused'] } },
      });
      if (!attendance) throw new Error('not_missed_or_not_owned');
      const request = await prisma.makeupRequest.upsert({
        where: { studentId_sessionId: { studentId: p.studentId, sessionId: p.sessionId } },
        create: { studentId: p.studentId, sessionId: p.sessionId, note: p.note || null },
        update: {},
      });
      result = { requestId: request.id, status: request.status };
    } else if (current.kind === 'book_consultation') {
      const p = current.payload as ConsultPayload;
      const family = await prisma.family.findUniqueOrThrow({ where: { id: familyId } });
      const saved = await createConsultation({ parentName: family.parentName, phone: family.phone, email: family.email, notes: p.notes || null, startsAt: new Date(p.startsAt) });
      result = { appointmentId: saved.id, startsAt: saved.startsAt.toISOString(), meetUrl: saved.meetUrl, calendarDegraded: false };
    } else {
      const p = current.payload as TrialPayload;
      const family = await prisma.family.findUniqueOrThrow({ where: { id: familyId } });
      const student = await prisma.student.findFirst({ where: { id: p.studentId, familyId } });
      if (!student) throw new Error('student_not_owned');
      const created = await createTrialBooking({
        programId: p.programId, slotId: p.slotId, parentName: family.parentName, phone: family.phone, email: family.email,
        childFirstName: student.firstName, childBirthYear: student.birthYear, familyId, studentId: student.id, neighborhood: 'riyadh',
        trialStartsAt: p.trialStartsAt ? new Date(p.trialStartsAt) : undefined,
      });
      result = { bookingId: created.booking.id, status: created.booking.status, appointmentId: created.appointment?.id ?? null, calendarDegraded: created.calendarDegraded };
    }
    return prisma.chatActionAudit.update({
      where: { id },
      data: { status: 'succeeded', result, executedAt: new Date() },
    });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 120) : 'execution_failed';
    const afterError = await reconcileAction(current, familyId).catch(() => null);
    if (afterError) {
      return prisma.chatActionAudit.update({
        where: { id },
        data: { status: 'succeeded', result: afterError, errorCode: null, executedAt: new Date() },
      });
    }
    const knownFailure = ['not_missed_or_not_owned', 'student_not_owned', 'slot_unavailable', 'slot_full', 'program_not_eligible', 'already_booked'].includes(code);
    const errorCode = knownFailure ? code : 'execution_outcome_uncertain';
    await prisma.chatActionAudit.update({ where: { id }, data: { status: 'failed', errorCode, executedAt: new Date() } });
    if (!knownFailure) {
      const open = await prisma.chatEscalation.findFirst({ where: { conversationId, reason: 'action_outcome_uncertain', status: 'open' } });
      if (!open) await prisma.chatEscalation.create({
        data: { conversationId, reason: 'action_outcome_uncertain', summary: 'Action outcome requires review', expiresAt: chatExpiry() },
      });
    }
    throw error;
  }
}