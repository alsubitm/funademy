import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { nextOccurrence } from '@/lib/appointments';

/**
 * Free-trial capacity is PER WEEKLY OCCURRENCE: a slot's `capacity` applies to
 * each concrete date it runs, and seats left = capacity − bookings for that
 * date. The legacy `ScheduleSlot.seatsLeft` column was a running counter that
 * was decremented on every trial ever booked and never restored, so recurring
 * slots eventually showed "full" forever. It is no longer read or written for
 * trial availability.
 */
type SlotLike = { id: number; weekday: number; time: string; capacity: number };

const occurrenceKey = (slotId: number, at: Date) => `${slotId}:${at.getTime()}`;

/** Returns the slots with `seatsLeft` computed for each slot's next occurrence. */
export async function withTrialSeats<T extends SlotLike>(
  slots: T[],
  now: Date = new Date(),
  db: Pick<Prisma.TransactionClient, 'booking'> = prisma,
): Promise<(T & { seatsLeft: number })[]> {
  if (slots.length === 0) return [];
  const occurrences = slots.map((slot) => ({ slot, at: nextOccurrence(slot.weekday, slot.time, now) }));
  const counts = await db.booking.groupBy({
    by: ['slotId', 'trialStartsAt'],
    where: { OR: occurrences.map(({ slot, at }) => ({ slotId: slot.id, trialStartsAt: at })) },
    _count: { _all: true },
  });
  const taken = new Map(
    counts
      .filter((c) => c.trialStartsAt)
      .map((c) => [occurrenceKey(c.slotId, c.trialStartsAt!), c._count._all]),
  );
  return occurrences.map(({ slot, at }) => ({
    ...slot,
    seatsLeft: Math.max(0, slot.capacity - (taken.get(occurrenceKey(slot.id, at)) ?? 0)),
  }));
}

/** Seats left for one concrete occurrence (call inside the booking transaction, after the seat lock). */
export async function trialSeatsLeftAt(
  db: Pick<Prisma.TransactionClient, 'booking'>,
  slot: { id: number; capacity: number },
  trialStartsAt: Date,
): Promise<number> {
  const taken = await db.booking.count({ where: { slotId: slot.id, trialStartsAt } });
  return Math.max(0, slot.capacity - taken);
}
