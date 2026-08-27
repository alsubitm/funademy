import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const bookings = await prisma.booking.findMany({
    include: { program: true, slot: true, communications: true, conversionItem: { include: { payment: true } } },
    orderBy: { createdAt: 'desc' },
  });
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
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = rowsWithPipeline.map((b) =>
      [
        b.id,
        b.createdAt.toISOString(),
        esc(b.parentName),
        esc(b.phone),
        esc(b.email),
        b.contactChannel,
        b.contactConsentAt?.toISOString() ?? '',
        esc(b.childFirstName),
        b.childBirthYear,
        esc(b.program.nameEn),
        b.trialStartsAt?.toISOString() ?? '',
        b.trialAttendance,
        esc(b.nextAction),
        b.nextActionAt?.toISOString() ?? '',
        esc(b.assignedTo),
        b.converted,
        b.status,
      ].join(','),
    );
    return new NextResponse([header, ...rows].join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': 'attachment; filename="ye-bookings.csv"',
      },
    });
  }

  const total = rowsWithPipeline.length;
  const attended = rowsWithPipeline.filter((b) => b.trialAttendance === 'present').length;
  const enrolled = rowsWithPipeline.filter((b) => b.converted).length;
  const attendedAndEnrolled = rowsWithPipeline.filter((b) => b.trialAttendance === 'present' && b.converted).length;
  return NextResponse.json({
    bookings: rowsWithPipeline,
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
