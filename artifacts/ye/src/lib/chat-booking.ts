import { Prisma } from '@prisma/client';
import { prisma, withDbRetry } from '@/lib/db';
import { addAttendeeToEvent, createMeetEvent } from '@/lib/google-calendar';
import { CONSULT_DURATION_MIN, consultAvailability, nextOccurrence } from '@/lib/appointments';
import { CATALOG } from '@/lib/catalog';
import { classroomLocation, classroomMapUrl, isCityOnlyLocation } from '@/lib/classroom-location';

type TrialInput = {
  programId: number; slotId: number; parentName: string; phone: string; email: string | null;
  childFirstName: string; childBirthYear: number; familyId: number;
  studentId?: number;
  neighborhood?: string;
  trialStartsAt?: Date;
};

/** Creates the durable trial request first. Calendar failure intentionally does
 * not undo it, matching the public route's manual-follow-up behaviour. */
export async function createTrialBooking(input: TrialInput) {
  // All callers must supply a server-authenticated family, never a body field.
  if (!input.familyId) throw new Error('unauthorized');
  const family = await prisma.family.findUnique({ where: { id: input.familyId } });
  if (!family) throw new Error('unauthorized');
  input = { ...input, phone: family.phone, parentName: family.parentName };
  const created = await withDbRetry(
    () =>
      prisma.$transaction(async (tx) => {
        if (input.studentId !== undefined) {
          const child = await tx.student.findFirst({ where: { id: input.studentId, familyId: input.familyId, firstName: input.childFirstName, birthYear: input.childBirthYear } });
          if (!child) throw new Error('student_not_owned');
        }
        const slot = await tx.scheduleSlot.findUnique({ where: { id: input.slotId }, include: { program: true } });
        if (!slot || slot.programId !== input.programId || !slot.active) throw new Error('slot_not_found');
        const age = new Date().getFullYear() - input.childBirthYear;
        if (age < slot.program.ageMin || age > slot.program.ageMax) throw new Error('program_not_eligible');
        const trialStartsAt = input.trialStartsAt ?? nextOccurrence(slot.weekday, slot.time);
        if (trialStartsAt.getTime() <= Date.now()) throw new Error('slot_unavailable');
        // Serialise a family's claim for this concrete occurrence. The database
        // has no occurrence column suitable for a unique constraint on legacy
        // Booking rows, so this closes the check/create race without broad locks.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trial:${input.phone}:${input.slotId}:${trialStartsAt.toISOString()}`}))`;
        const duplicate = await tx.booking.findFirst({
          where: { programId: input.programId, slotId: input.slotId, phone: input.phone, childFirstName: input.childFirstName, childBirthYear: input.childBirthYear, trialStartsAt },
          select: { id: true },
        });
        if (duplicate) throw new Error('already_booked');
        // Serialize across slots and child identities for this verified phone.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`trial-quota:${input.phone}`}))`;
        const recent = await tx.booking.count({
          where: { phone: input.phone, createdAt: { gte: new Date(Date.now() - 86400_000) } },
        });
        if (recent >= 5) throw new Error('trial_limit');
        const claimed = await tx.scheduleSlot.updateMany({
          where: { id: input.slotId, programId: input.programId, active: true, seatsLeft: { gt: 0 } },
          data: { seatsLeft: { decrement: 1 } },
        });
        if (!claimed.count) throw new Error('slot_full');
        const reminderAt = new Date(trialStartsAt.getTime() - 24 * 60 * 60_000);
        const followUpAt = new Date(trialStartsAt.getTime() + 60 * 60_000);
        const booking = await tx.booking.create({
          data: {
            programId: input.programId, slotId: input.slotId, parentName: input.parentName, phone: input.phone, email: input.email,
            childFirstName: input.childFirstName, childBirthYear: input.childBirthYear, neighborhood: input.neighborhood || 'riyadh',
            contactChannel: input.email ? 'email' : 'phone', contactConsentAt: new Date(), trialStartsAt, reminderAt, followUpAt,
            communications: { create: [{ kind: 'reminder', dueAt: reminderAt }, { kind: 'follow_up', dueAt: followUpAt }] },
          },
        });
        return { booking, slot };
      }),
    { operation: 'trial-booking-seat-reservation', kind: 'transaction' },
  );

  try {
    const { booking, slot } = created;
    const existing = await prisma.appointment.findFirst({
      where: { kind: 'trial', programId: input.programId, startsAt: booking.trialStartsAt!, status: 'scheduled', calendarEventId: { not: null }, meetUrl: null },
    });
    let meet: { eventId: string; meetUrl: string | null };
    if (existing?.calendarEventId) {
      meet = { eventId: existing.calendarEventId, meetUrl: existing.meetUrl };
      // Guest invitation failure must not hide an already-scheduled trial;
      // the original booking contract falls back to manual contact.
      if (input.email) await addAttendeeToEvent(existing.calendarEventId, input.email).catch(() => {});
    } else {
      meet = await createMeetEvent({
        summary: `حصة تجريبية FunAdemy — ${slot.program.nameAr}`,
        description: `حصة تجريبية حضورية في الرياض\nالبرنامج: ${slot.program.nameAr} / ${slot.program.nameEn}\n${classroomLocation(slot.location, 'ar')}\n${isCityOnlyLocation(slot.location) ? 'خريطة المدينة وليست موقع المقر' : 'البحث عن المقر في الخرائط'}: ${classroomMapUrl(slot.location)}`,
        inPerson: true,
        location: isCityOnlyLocation(slot.location) ? 'Riyadh, Saudi Arabia' : slot.location,
        startsAt: booking.trialStartsAt!, durationMin: CATALOG[slot.program.slug]?.lessonMin ?? 45, attendeeEmail: input.email,
      });
    }
    const appointment = await prisma.appointment.create({
      data: {
        kind: 'trial', parentName: input.parentName, phone: input.phone, email: input.email, childFirstName: input.childFirstName,
        programId: input.programId, bookingId: booking.id, startsAt: booking.trialStartsAt!,
        durationMin: CATALOG[slot.program.slug]?.lessonMin ?? 45, meetUrl: meet.meetUrl, calendarEventId: meet.eventId,
      },
    });
    return { booking, appointment, calendarDegraded: false };
  } catch {
    return { booking: created.booking, appointment: null, calendarDegraded: true };
  }
}

type ConsultInput = { parentName: string; phone: string; email: string | null; notes: string | null; startsAt: Date };

/** Atomic consultation reservation with calendar compensation on failure. */
export async function createConsultation(input: ConsultInput) {
  const open = await consultAvailability();
  if (!open.some((s) => s.startsAt === input.startsAt.toISOString())) throw new Error('slot_unavailable');
  let appointment;
  try {
    appointment = await prisma.appointment.create({
      data: { kind: 'consult', parentName: input.parentName, phone: input.phone, email: input.email, notes: input.notes, startsAt: input.startsAt, durationMin: CONSULT_DURATION_MIN, consultKey: input.startsAt.toISOString() },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new Error('slot_unavailable');
    throw error;
  }
  try {
    const meet = await createMeetEvent({
      summary: `استشارة FunAdemy — ${input.parentName}`,
      description: `موعد استشارة عبر موقع FunAdemy\nالاسم: ${input.parentName}\nالجوال: ${input.phone}${input.notes ? `\nملاحظات: ${input.notes}` : ''}`,
      startsAt: input.startsAt, durationMin: CONSULT_DURATION_MIN, attendeeEmail: input.email,
    });
    return await prisma.appointment.update({ where: { id: appointment.id }, data: { meetUrl: meet.meetUrl, calendarEventId: meet.eventId } });
  } catch {
    await prisma.appointment.delete({ where: { id: appointment.id } }).catch(() => {});
    throw new Error('calendar_failed');
  }
}