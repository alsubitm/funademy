import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { csvCell } from '@/lib/csv';
import { requireAdmin } from '../guard';
import { bookingFilter, listPage, pageRows, paidTrial } from '@/lib/admin-list-query';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const csv = req.nextUrl.searchParams.get('format') === 'csv';
  let page;
  let where;
  try {
    page = listPage(csv ? new URLSearchParams() : req.nextUrl.searchParams);
    where = csv ? {} : bookingFilter(req.nextUrl.searchParams);
  } catch {
    return NextResponse.json({ error: 'invalid_query' }, { status: 400 });
  }
  const result = await prisma.$transaction(async (tx) => {
    const rows = await tx.booking.findMany({
      where: { AND: [where, ...(csv ? [] : [{ id: page.id }])] },
      include: { program: true, slot: true, communications: true, conversionItem: { include: { payment: true } } },
      orderBy: csv ? { id: 'desc' } : page.orderBy,
      ...(csv ? {} : { take: page.take }),
    });
    const bookings = pageRows(rows, page);
    if (csv) return { bookings };
    const [total, matching, attended, enrolled, attendedAndEnrolled, programs, previous, next] = await Promise.all([
      tx.booking.count(),
      tx.booking.count({ where }),
      tx.booking.count({ where: { trialAttendance: 'present' } }),
      tx.booking.count({ where: paidTrial }),
      tx.booking.count({ where: { AND: [paidTrial, { trialAttendance: 'present' }] } }),
      tx.program.findMany({ where: { bookings: { some: {} } }, select: { id: true, nameAr: true }, orderBy: { id: 'asc' } }),
      tx.booking.findFirst({ where: { AND: [where, { id: { gt: bookings[0]?.id ?? page.edge ?? 0 } }] }, select: { id: true } }),
      tx.booking.findFirst({ where: { AND: [where, { id: { lt: bookings.at(-1)?.id ?? page.edge ?? 0 } }] }, select: { id: true } }),
    ]);
    return { bookings, total, matching, attended, enrolled, attendedAndEnrolled, programs,
      previousCursor: previous ? `prev:${bookings[0]?.id ?? page.edge}` : null,
      nextCursor: next ? `next:${bookings.at(-1)?.id ?? page.edge}` : null };
  }, { isolationLevel: 'RepeatableRead' });
  const { bookings } = result;
  const appointments = await prisma.appointment.findMany({
    where: { bookingId: { in: bookings.map((booking) => booking.id) }, kind: 'trial' },
    orderBy: { createdAt: 'desc' },
  });
  const appointmentByBooking = new Map(appointments.map((appointment) => [appointment.bookingId, appointment]));
  const now = new Date();
  const rowsWithPipeline = bookings.map((booking) => {
    const appointment = appointmentByBooking.get(booking.id) ?? null;
    const trialStartsAt = booking.trialStartsAt ?? appointment?.startsAt ?? null;
    const reminderAt = booking.reminderAt ?? (trialStartsAt ? new Date(trialStartsAt.getTime() - 24 * 60 * 60_000) : null);
    const followUpAt = booking.followUpAt ?? (trialStartsAt ? new Date(trialStartsAt.getTime() + 60 * 60_000) : null);
    const converted = booking.conversionItem?.payment.status === 'paid';
    const enrollmentUrl = `/enroll?program=${encodeURIComponent(booking.program.slug)}&trial=${booking.id}`;
    const reminder = booking.communications.find((item) => item.kind === 'reminder');
    const followUp = booking.communications.find((item) => item.kind === 'follow_up');
    let nextAction = 'مكتمل';
    let nextActionAt: Date | null = null;
    if (!converted) {
      if (!booking.contactConsentAt || !trialStartsAt) {
        nextAction = 'استكمال موافقة التواصل وتحديد موعد الحصة';
      } else if (reminder?.status === 'failed' || followUp?.status === 'failed') {
        nextAction = 'إعادة محاولة إرسال الرسالة المتعثرة';
      } else if (booking.trialAttendance === 'present' && followUp?.status === 'sent') {
        nextAction = 'انتظار إكمال التسجيل والدفع';
      } else if (booking.trialAttendance === 'present') {
        nextAction = 'إرسال رابط التسجيل والدفع';
        nextActionAt = followUpAt;
      } else if (booking.trialAttendance === 'absent') {
        nextAction = 'التواصل لإعادة الجدولة';
        nextActionAt = followUpAt;
      } else if (reminder?.status === 'sent') {
        nextAction = 'انتظار موعد الحصة';
        nextActionAt = trialStartsAt;
      } else if (reminderAt && now < reminderAt) {
        nextAction = 'تذكير قبل الحصة';
        nextActionAt = reminderAt;
      } else if (now < trialStartsAt) {
        nextAction = 'إرسال التذكير الآن';
        nextActionAt = reminderAt;
      } else {
        nextAction = 'تسجيل الحضور';
        nextActionAt = trialStartsAt;
      }
    }
    return {
      ...booking,
      trialStartsAt,
      reminderAt,
      followUpAt,
      appointment,
      converted,
      enrollmentUrl,
      nextAction,
      nextActionAt,
    };
  });

  if (req.nextUrl.searchParams.get('format') === 'csv') {
    const header = 'id,created_at,parent_name,phone,email,contact_channel,contact_consent_at,child_first_name,child_birth_year,program,trial_starts_at,attendance,next_action,next_action_at,assigned_to,converted,status';
    const rows = rowsWithPipeline.map((b) =>
      [
        b.id,
        b.createdAt.toISOString(),
        b.parentName,
        b.phone,
        b.email,
        b.contactChannel,
        b.contactConsentAt?.toISOString() ?? '',
        b.childFirstName,
        b.childBirthYear,
        b.program.nameEn,
        b.trialStartsAt?.toISOString() ?? '',
        b.trialAttendance,
        b.nextAction,
        b.nextActionAt?.toISOString() ?? '',
        b.assignedTo,
        b.converted,
        b.status,
      ].map(csvCell).join(','),
    );
    return new NextResponse([header, ...rows].join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ye-bookings.csv"',
      },
    });
  }

  const { total = 0, attended = 0, enrolled = 0, attendedAndEnrolled = 0 } = result;
  return NextResponse.json({
    bookings: rowsWithPipeline,
    programs: result.programs,
    pagination: { total, matching: result.matching, previousCursor: result.previousCursor, nextCursor: result.nextCursor },
    metrics: {
      total,
      attended,
      enrolled,
      attendanceRatePct: total ? Math.round((attended / total) * 100) : 0,
      bookingConversionPct: total ? Math.round((enrolled / total) * 100) : 0,
      attendedConversionPct: attended ? Math.round((attendedAndEnrolled / attended) * 100) : 0,
    },
  });
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const b = await req.json().catch(() => null);
  const id = Number(b?.id);
  const status = b?.status == null ? undefined : String(b.status);
  const trialAttendance = b?.trialAttendance == null ? undefined : String(b.trialAttendance);
  const assignedTo = b?.assignedTo == null ? undefined : String(b.assignedTo).trim();
  const followUpAt = b?.followUpAt == null ? undefined : new Date(String(b.followUpAt));
  const retryCommunicationId = b?.retryCommunicationId == null ? undefined : Number(b.retryCommunicationId);
  if (
    !id ||
    (status !== undefined && !['new', 'contacted', 'enrolled'].includes(status)) ||
    (trialAttendance !== undefined && !['pending', 'present', 'absent'].includes(trialAttendance)) ||
    (assignedTo !== undefined && (!assignedTo || assignedTo.length > 80)) ||
    (followUpAt !== undefined && Number.isNaN(followUpAt.getTime())) ||
    (retryCommunicationId !== undefined && !Number.isInteger(retryCommunicationId))
  ) {
    return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  if (retryCommunicationId !== undefined) {
    const retried = await prisma.trialCommunication.updateMany({
      where: { id: retryCommunicationId, bookingId: id, status: 'failed' },
      data: {
        status: 'pending',
        attempts: 0,
        claimedAt: null,
        claimToken: null,
        lastError: null,
      },
    });
    if (!retried.count) return NextResponse.json({ error: 'communication_not_retryable' }, { status: 409 });
    return NextResponse.json({ retried: true });
  }
  const booking = await prisma.booking.update({
    where: { id },
    data: {
      ...(status ? { status: status as 'new' | 'contacted' | 'enrolled' } : {}),
      ...(trialAttendance
        ? {
            trialAttendance: trialAttendance as 'pending' | 'present' | 'absent',
            attendedAt: trialAttendance === 'present' ? new Date() : null,
            status: status
              ? (status as 'new' | 'contacted' | 'enrolled')
              : trialAttendance === 'pending'
                ? undefined
                : 'contacted',
          }
        : {}),
      ...(assignedTo !== undefined ? { assignedTo } : {}),
      ...(followUpAt !== undefined ? { followUpAt } : {}),
    },
  });
  return NextResponse.json({ booking });
}
