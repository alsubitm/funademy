import Link from 'next/link';
import { prisma } from '@/lib/db';
import { arabicDigits, WEEKDAYS_AR, WEEKDAYS_EN } from '@/lib/constants';
import { portalDict } from '@/app/portal/dict';

type Lang = 'ar' | 'en';

const BADGE_ICONS: Record<string, string> = {
  star: '⭐', gear: '⚙️', rocket: '🚀', crown: '👑', bolt: '⚡', kite: '🪁',
};

function fmtDate(lang: Lang, d: Date): string {
  const s = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return lang === 'ar' ? arabicDigits(s) : s;
}
const fmt = (lang: Lang, v: number | string) => (lang === 'ar' ? arabicDigits(v) : String(v));

export async function PortalView({ lang, familyId, selectedChild }: { lang: Lang; familyId: number; selectedChild?: number }) {
  const d = portalDict[lang];
  const weekdays = lang === 'ar' ? WEEKDAYS_AR : WEEKDAYS_EN;
  const base = lang === 'ar' ? '' : '/en';

  const students = await prisma.student.findMany({
    where: { familyId },
    orderBy: { id: 'asc' },
  });

  if (students.length === 0) {
    return (
      <div className="ptl-card" style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: 14, color: 'var(--mut)' }}>{d.noKids}</p>
        <Link className="btn b" style={{ padding: '12px 26px', fontSize: 15 }} href={`${base}/account`}>{d.goKids}</Link>
      </div>
    );
  }

  const child = students.find((s) => s.id === selectedChild) ?? students[0];
  const now = new Date();

  const [enrollments, attendance, studentSkills, studentBadges] = await Promise.all([
    prisma.enrollment.findMany({
      where: { studentId: child.id, status: { not: 'cancelled' } },
      include: { courseRun: { include: { program: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.attendance.findMany({
      where: { studentId: child.id },
      include: { session: { include: { courseRun: { include: { program: true } } } } },
      orderBy: { session: { date: 'desc' } },
      take: 20,
    }),
    prisma.studentSkill.findMany({ where: { studentId: child.id } }),
    prisma.studentBadge.findMany({
      where: { studentId: child.id },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
    }),
  ]);

  const runIds = enrollments.filter((e) => e.status === 'active' || e.status === 'pending').map((e) => e.courseRunId);
  const programIds = [...new Set(enrollments.map((e) => e.courseRun.programId))];

  const [upcoming, programSkills] = await Promise.all([
    runIds.length
      ? prisma.classSession.findMany({
          where: { courseRunId: { in: runIds }, date: { gte: now }, status: 'scheduled' },
          include: { courseRun: { include: { program: true } } },
          orderBy: { date: 'asc' },
          take: 6,
        })
      : Promise.resolve([]),
    programIds.length
      ? prisma.skill.findMany({ where: { programId: { in: programIds } }, orderBy: [{ programId: 'asc' }, { position: 'asc' }] })
      : Promise.resolve([]),
  ]);

  const skillState = new Map(studentSkills.map((s) => [s.skillId, s.status]));
  const progName = (p: { nameAr: string; nameEn: string }) => (lang === 'ar' ? p.nameAr : p.nameEn);
  const statusLabel: Record<string, string> = {
    active: d.statusActive, pending: d.statusPending, paused: d.statusPaused, cancelled: d.statusCancelled,
  };
  const attLabel: Record<string, string> = { present: d.present, absent: d.absent, late: d.late, excused: d.excused };
  const skillLabel: Record<string, string> = { mastered: d.mastered, in_progress: d.inProgress, locked: d.locked };

  return (
    <>
      {/* child switcher */}
      <div className="ptl-switch">
        {students.map((s) => (
          <Link key={s.id} className={`ptl-kid ${s.id === child.id ? 'sel' : ''}`} href={`${base}/portal?child=${s.id}`}>
            <span className="dot" />
            {s.firstName}
          </Link>
        ))}
      </div>

      {/* enrollments */}
      <div className="ptl-card">
        <h3><span className="ico">🎓</span>{d.enrollments}</h3>
        {enrollments.length === 0 ? (
          <div className="ptl-empty">
            {d.noEnroll}
            <div style={{ marginTop: 12 }}>
              <Link className="btn y" style={{ padding: '10px 24px', fontSize: 14 }} href={`${base}/enroll`}>{d.goEnroll}</Link>
            </div>
          </div>
        ) : (
          enrollments.map((e) => (
            <div key={e.id} className="ptl-enr">
              <div className="bar" style={{ background: e.courseRun.program.color }} />
              <div className="info">
                <div className="nm">{progName(e.courseRun.program)}</div>
                <div className="mt">
                  {(lang === 'ar' ? e.courseRun.titleAr : e.courseRun.titleEn) ?? ''} · {weekdays[e.courseRun.weekday]} {e.courseRun.time}
                  {e.courseRun.location ? ` · 📍 ${e.courseRun.location}` : ''}
                </div>
              </div>
              <div style={{ textAlign: 'end' }}>
                <span className={`ptl-tag ${e.status}`}>{statusLabel[e.status]}</span>
                <div className="price">
                  {fmt(lang, Math.round(e.monthlyPriceSar * (100 - e.discountPct)) / 100)} {d.perMonth}
                </div>
                {e.discountPct > 0 && <span className="ptl-tag gold">{d.siblingOff}</span>}
              </div>
            </div>
          ))
        )}
      </div>

      {/* upcoming sessions */}
      <div className="ptl-card">
        <h3><span className="ico">📅</span>{d.upcoming}</h3>
        {upcoming.length === 0 ? (
          <div className="ptl-empty">{d.noUpcoming}</div>
        ) : (
          upcoming.map((s) => (
            <div key={s.id} className="ptl-sess">
              <span className="d">{fmtDate(lang, s.date)}</span>
              <span className="p">{progName(s.courseRun.program)} — {weekdays[s.courseRun.weekday]} {s.courseRun.time}</span>
            </div>
          ))
        )}
      </div>

      {/* attendance history */}
      <div className="ptl-card">
        <h3><span className="ico">✅</span>{d.attendance}</h3>
        {attendance.length === 0 ? (
          <div className="ptl-empty">{d.noAttendance}</div>
        ) : (
          attendance.map((a) => (
            <div key={a.id} className="ptl-sess">
              <span className="d">{fmtDate(lang, a.session.date)}</span>
              <span className="p">{progName(a.session.courseRun.program)}</span>
              <span className={`ptl-att ${a.status}`}>{attLabel[a.status] ?? a.status}</span>
            </div>
          ))
        )}
      </div>

      {/* skill map */}
      <div className="ptl-card">
        <h3><span className="ico">🧩</span>{d.skills}</h3>
        {programSkills.length === 0 ? (
          <div className="ptl-empty">{d.noEnroll}</div>
        ) : (
          programIds.map((pid) => {
            const list = programSkills.filter((sk) => sk.programId === pid);
            if (list.length === 0) return null;
            const prog = enrollments.find((e) => e.courseRun.programId === pid)!.courseRun.program;
            return (
              <div key={pid}>
                <div className="ptl-prog-name">{progName(prog)}</div>
                <div className="ptl-skills">
                  {list.map((sk) => {
                    const st = skillState.get(sk.id) ?? 'locked';
                    return (
                      <div key={sk.id} className={`ptl-skill ${st}`}>
                        <span className="st">{st === 'mastered' ? '★' : st === 'in_progress' ? '⚙' : '·'}</span>
                        <span className="lbl">{lang === 'ar' ? sk.nameAr : sk.nameEn}</span>
                        <span className="state">{skillLabel[st]}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* badges */}
      <div className="ptl-card">
        <h3><span className="ico">🏅</span>{d.badges}</h3>
        {studentBadges.length === 0 ? (
          <div className="ptl-empty">{d.noBadges}</div>
        ) : (
          <div className="ptl-badges">
            {studentBadges.map((b) => (
              <div key={b.id} className="ptl-badge">
                <div className="ico">{BADGE_ICONS[b.badge.iconKey] ?? '⭐'}</div>
                <div className="nm">{lang === 'ar' ? b.badge.nameAr : b.badge.nameEn}</div>
                <div className="dt">{d.awardedOn} {fmtDate(lang, b.awardedAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
