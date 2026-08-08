import Link from 'next/link';
import { prisma } from '@/lib/db';
import { arabicDigits, WEEKDAYS_AR, WEEKDAYS_EN } from '@/lib/constants';
import { portalDict } from '@/app/portal/dict';
import { MakeupButton } from './MakeupButton';
import { effectiveMonthlySar, subscriptionState } from '@/lib/billing';
import { RenewButton } from '@/components/portal/RenewButton';
import { portalSessions, joinUrlFor } from '@/lib/portal-sessions';

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

  const [enrollments, attendance, studentSkills, makeupRequests, studentBadges] = await Promise.all([
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
    prisma.makeupRequest.findMany({
      where: { studentId: child.id },
      include: { session: { include: { courseRun: { include: { program: true } } } } },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.studentBadge.findMany({
      where: { studentId: child.id },
      include: { badge: true },
      orderBy: { awardedAt: 'desc' },
    }),
  ]);

  const programIds = [...new Set(enrollments.map((e) => e.courseRun.programId))];

  const [{ upcoming, recorded }, programSkills] = await Promise.all([
    portalSessions(child.id, now),
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
  const mkLabel: Record<string, string> = { pending: d.mkPending, approved: d.mkApproved, rejected: d.mkRejected };
  const makeupBySession = new Map(makeupRequests.map((m) => [m.sessionId, m]));
  const skillLabel: Record<string, string> = { mastered: d.mastered, in_progress: d.inProgress, locked: d.locked };

  return (
    <>
      {/* renewal reminder banner */}
      <RenewalAlert lang={lang} familyId={familyId} d={d} />

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
          upcoming.map((s) => {
            const joinUrl = joinUrlFor(s);
            return (
              <div key={s.id} className="ptl-sess">
                <span className="d">{fmtDate(lang, s.date)}</span>
                <span className="p">
                  {progName(s.courseRun.program)} — {weekdays[s.courseRun.weekday]} {fmt(lang, s.courseRun.time)}
                  <span className="loc">
                    {s.courseRun.format === 'online' ? `💻 ${d.online}` : `📍 ${s.courseRun.location ?? d.inPerson}`}
                  </span>
                </span>
                {joinUrl && (
                  <a className="ptl-live" href={joinUrl} target="_blank" rel="noopener noreferrer">
                    🎥 {d.joinLive}
                  </a>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* recorded classes */}
      {recorded.length > 0 && (
        <div className="ptl-card">
          <h3><span className="ico">🎬</span>{d.recordings}</h3>
          {recorded.map((s) => (
            <div key={s.id} className="ptl-sess">
              <span className="d">{fmtDate(lang, s.date)}</span>
              <span className="p">{progName(s.courseRun.program)}</span>
              <a className="ptl-rec" href={s.recordingUrl!} target="_blank" rel="noopener noreferrer">
                ▶️ {d.watchRecording}
              </a>
            </div>
          ))}
        </div>
      )}

      {/* attendance history */}
      <div className="ptl-card">
        <h3><span className="ico">✅</span>{d.attendance}</h3>
        {attendance.length === 0 ? (
          <div className="ptl-empty">{d.noAttendance}</div>
        ) : (
          attendance.map((a) => {
            const missed = a.status === 'absent' || a.status === 'excused';
            const mk = makeupBySession.get(a.sessionId);
            return (
              <div key={a.id} className="ptl-sess">
                <span className="d">{fmtDate(lang, a.session.date)}</span>
                <span className="p">{progName(a.session.courseRun.program)}</span>
                <span className={`ptl-att ${a.status}`}>{attLabel[a.status] ?? a.status}</span>
                {missed && (mk ? (
                  <span className={`ptl-mk ${mk.status}`}>{mkLabel[mk.status]}</span>
                ) : (
                  <MakeupButton
                    studentId={child.id}
                    sessionId={a.sessionId}
                    labels={{ request: d.mkRequest, sending: d.mkSending, failed: d.mkFailed }}
                  />
                ))}
              </div>
            );
          })
        )}
      </div>

      {/* makeup requests */}
      {makeupRequests.length > 0 && (
        <div className="ptl-card">
          <h3><span className="ico">🔁</span>{d.makeups}</h3>
          {makeupRequests.map((m) => (
            <div key={m.id} className="ptl-sess ptl-mk-row">
              <span className="d">{fmtDate(lang, m.session.date)}</span>
              <span className="p">
                {progName(m.session.courseRun.program)}
                {m.adminNote && <span className="loc">💬 {m.adminNote}</span>}
              </span>
              <span className={`ptl-mk ${m.status}`}>{mkLabel[m.status]}</span>
            </div>
          ))}
        </div>
      )}

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

      {/* payments & subscription */}
      <PaymentsSection lang={lang} familyId={familyId} d={d} />

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

async function RenewalAlert({ lang, familyId, d }: { lang: Lang; familyId: number; d: (typeof portalDict)['ar'] }) {
  const subs = await prisma.enrollment.findMany({
    where: { student: { familyId }, status: { in: ['active', 'pending'] } },
    include: { student: true, courseRun: { include: { program: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const flagged = subs
    .map((e) => ({ e, st: subscriptionState(e.paidThrough) }))
    .filter(({ st }) => st === 'due' || st === 'due_soon');
  if (flagged.length === 0) return null;

  const hasDue = flagged.some(({ st }) => st === 'due');
  const progName = (p: { nameAr: string; nameEn: string }) => (lang === 'ar' ? p.nameAr : p.nameEn);

  return (
    <div className={`ptl-alert ${hasDue ? 'due' : 'due_soon'}`} role="alert">
      <div className="hd">
        <span className="ico" aria-hidden>{hasDue ? '⚠️' : '⏳'}</span>
        <span className="ttl">{hasDue ? d.alertDueTitle : d.alertDueSoonTitle}</span>
      </div>
      <div className="sub">{d.alertRenewNow}</div>
      {flagged.map(({ e, st }) => {
        const amount = Math.round(effectiveMonthlySar(e.monthlyPriceSar, e.discountPct));
        return (
          <div key={e.id} className="row">
            <span className="who">
              {st === 'due' ? d.alertDue : d.alertDueSoon} {e.student.firstName} — {progName(e.courseRun.program)}
              {e.paidThrough ? ` (${d.alertOn} ${fmtDate(lang, e.paidThrough)})` : ''}
            </span>
            <RenewButton lang={lang} enrollmentId={e.id} amountSar={amount} />
          </div>
        );
      })}
    </div>
  );
}

async function PaymentsSection({ lang, familyId, d }: { lang: Lang; familyId: number; d: (typeof portalDict)['ar'] }) {
  const base = lang === 'ar' ? '' : '/en';
  const [subs, payments] = await Promise.all([
    prisma.enrollment.findMany({
      where: { student: { familyId }, status: { in: ['active', 'pending'] } },
      include: { student: true, courseRun: { include: { program: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.payment.findMany({
      where: { familyId },
      include: { items: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
  ]);

  const stateLabel: Record<string, string> = {
    paid: d.subPaid, due_soon: d.subDueSoon, due: d.subDue, none: d.subNone,
  };
  const progName = (p: { nameAr: string; nameEn: string }) => (lang === 'ar' ? p.nameAr : p.nameEn);

  return (
    <div className="ptl-card">
      <h3><span className="ico">💳</span>{d.payments}</h3>

      {/* subscription status per child */}
      {subs.length > 0 && (
        <>
          <div className="ptl-prog-name">{d.subFor}</div>
          {subs.map((e) => {
            const st = subscriptionState(e.paidThrough);
            const amount = Math.round(effectiveMonthlySar(e.monthlyPriceSar, e.discountPct));
            return (
              <div key={e.id} className="ptl-enr">
                <div className={`bar sub-${st}`} style={{ background: e.courseRun.program.color }} />
                <div className="info">
                  <div className="nm">{e.student.firstName} — {progName(e.courseRun.program)}</div>
                  <div className="mt">
                    {fmt(lang, amount)} {d.perMonth}
                    {e.paidThrough ? ` · ${d.paidThrough} ${fmtDate(lang, e.paidThrough)}` : ''}
                  </div>
                </div>
                <div className="ptl-sub-side">
                  <span className={`ptl-tag sub-${st}`}>{stateLabel[st]}</span>
                  <RenewButton lang={lang} enrollmentId={e.id} amountSar={amount} />
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* payment history + receipts */}
      <div className="ptl-prog-name">{d.history}</div>
      {payments.length === 0 ? (
        <div className="ptl-empty">
          {d.noPayments}
          {subs.length === 0 && (
            <div style={{ marginTop: 12 }}>
              <Link className="btn y" style={{ padding: '10px 24px', fontSize: 14 }} href={`${base}/enroll`}>{d.goEnroll}</Link>
            </div>
          )}
        </div>
      ) : (
        payments.map((p) => (
          <div key={p.id} className="ptl-pay">
            <span className="d">{fmtDate(lang, p.createdAt)}</span>
            <span className="p">
              {p.kind === 'renewal' ? d.kindRenewal : d.kindEnrollment}
              {' — '}
              {p.items.map((i) => i.studentName).join(lang === 'ar' ? '، ' : ', ')}
              {p.simulated && <span className="ptl-tag gold" style={{ marginInlineStart: 8 }}>{d.simulatedPay}</span>}
            </span>
            <span className="amt">{fmt(lang, p.totalSar)} {d.sar}</span>
            <a className="rcpt" href={`/svc/account/payments/${p.id}/receipt?lang=${lang}`} target="_blank" rel="noopener">
              🧾 {d.receipt}
            </a>
          </div>
        ))
      )}
    </div>
  );
}
