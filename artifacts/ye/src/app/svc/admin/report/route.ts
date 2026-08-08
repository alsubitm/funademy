import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '../guard';

export const dynamic = 'force-dynamic';

/**
 * Monthly turnover report — one row per course run for a given month.
 * GET ?month=YYYY-MM (default: current month) &format=csv to download.
 * Attendance rate = present+late marks / (held sessions in month × eligible roster);
 * unmarked students count as absent, so the rate is not overstated.
 */
export async function GET(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const now = new Date();
  // All calendar math is Asia/Riyadh (UTC+3, no DST): shift "now" by +3h and read UTC fields.
  const riyadhNow = new Date(now.getTime() + 3 * 3600_000);
  const monthParam = req.nextUrl.searchParams.get('month');
  let year = riyadhNow.getUTCFullYear();
  let month = riyadhNow.getUTCMonth(); // 0-based
  if (monthParam) {
    const m = /^(\d{4})-(\d{2})$/.exec(monthParam);
    if (!m) return NextResponse.json({ error: 'validation' }, { status: 400 });
    year = Number(m[1]);
    month = Number(m[2]) - 1;
    if (month < 0 || month > 11) return NextResponse.json({ error: 'validation' }, { status: 400 });
  }
  // Riyadh calendar-month boundaries as UTC instants (Riyadh 00:00 = 21:00 UTC previous day).
  const monthStart = new Date(Date.UTC(year, month, 1) - 3 * 3600_000);
  const monthEnd = new Date(Date.UTC(year, month + 1, 1) - 3 * 3600_000);
  const monthLabel = `${year}-${String(month + 1).padStart(2, '0')}`;

  const runs = await prisma.courseRun.findMany({
    // Only runs whose period overlaps the requested month.
    where: { startDate: { lt: monthEnd }, endDate: { gte: monthStart } },
    include: {
      program: { select: { nameAr: true, nameEn: true } },
      enrollments: {
        // Month-aware eligibility: only enrollments that had started by the end of
        // the requested month count toward its revenue/roster. Note: the schema keeps
        // no status-change history, so a later-cancelled enrollment is excluded from
        // all months (best effort until a status-history/snapshot table exists).
        where: { status: { in: ['active', 'paused'] } },
        select: { status: true, monthlyPriceSar: true, discountPct: true, startedAt: true, createdAt: true },
      },
      sessions: {
        where: { date: { gte: monthStart, lt: monthEnd } },
        select: { id: true, date: true, status: true, attendance: { select: { status: true } } },
      },
    },
    orderBy: [{ active: 'desc' }, { programId: 'asc' }, { startDate: 'asc' }],
  });

  const rows = runs.map((r) => {
    // Eligible this month = started (startedAt, else createdAt) before the month ends.
    const eligible = r.enrollments.filter((e) => (e.startedAt ?? e.createdAt) < monthEnd);
    // Paused enrollments stay on the roster but don't produce revenue.
    const billed = eligible.filter((e) => e.status === 'active');
    const revenue = Math.round(billed.reduce((s, e) => s + (e.monthlyPriceSar * (100 - e.discountPct)) / 100, 0));
    const held = r.sessions.filter((s) => s.date <= now && s.status !== 'cancelled');
    const rosterSize = eligible.length;
    const expectedMarks = held.length * rosterSize; // unmarked students count as absent
    const present = held
      .flatMap((s) => s.attendance)
      .filter((m) => m.status === 'present' || m.status === 'late').length;
    return {
      runId: r.id,
      program: r.program.nameEn,
      programAr: r.program.nameAr,
      title: r.titleEn ?? r.titleAr ?? '',
      active: r.active,
      capacity: r.capacity,
      enrollments: rosterSize,
      seatsFilledPct: r.capacity ? Math.round(((r.capacity - r.seatsLeft) / r.capacity) * 100) : 0,
      monthlyRevenueSar: revenue,
      sessionsHeld: held.length,
      sessionsInMonth: r.sessions.length,
      attendanceRatePct: expectedMarks ? Math.round((present / expectedMarks) * 100) : null,
    };
  });

  if (req.nextUrl.searchParams.get('format') === 'csv') {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header =
      'month,run_id,program,title,active,capacity,enrollments,seats_filled_pct,monthly_revenue_sar,sessions_held,sessions_in_month,attendance_rate_pct';
    const lines = rows.map((r) =>
      [
        monthLabel, r.runId, esc(r.program), esc(r.title), r.active, r.capacity, r.enrollments,
        r.seatsFilledPct, r.monthlyRevenueSar, r.sessionsHeld, r.sessionsInMonth,
        r.attendanceRatePct ?? '',
      ].join(','),
    );
    return new NextResponse([header, ...lines].join('\n'), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="funademy-report-${monthLabel}.csv"`,
      },
    });
  }
  return NextResponse.json({ month: monthLabel, rows });
}
