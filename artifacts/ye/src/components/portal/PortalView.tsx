import Link from 'next/link';
import { isTransientDatabaseError, prisma } from '@/lib/db';
import { arabicDigits, WEEKDAYS_AR, WEEKDAYS_EN } from '@/lib/constants';
import { portalDict } from '@/app/(ar)/portal/dict';
import { MakeupButton } from './MakeupButton';
import { effectiveMonthlySar, subscriptionState } from '@/lib/billing';
import { RenewButton } from '@/components/portal/RenewButton';
import { portalSessions, joinUrlFor } from '@/lib/portal-sessions';
import { formatRiyadh } from '@/lib/appointments';
import { moyasarLive, tamaraLive, paymentAvailability } from '@/lib/payments';

type Lang = 'ar' | 'en';

const BADGE_ICONS: Record<string, string> = {
  star: '⭐', gear: '⚙️', rocket: '🚀', crown: '👑', bolt: '⚡', kite: '🪁',
};

function fmtDate(lang: Lang, d: Date): string {
  const s = d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return lang === 'ar' ? arabicDigits(s) : s;
}

/** Calendar day (YYYY-MM-DD) in Riyadh time, for today/tomorrow labels. */
function riyadhDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
const fmt = (lang: Lang, v: number | string) => (lang === 'ar' ? arabicDigits(v) : String(v));
const safeExternalUrl = (value: string | null): string | null => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null;
  } catch {
    return null;
  }
};

export async function PortalView(props: { lang: Lang; familyId: number; selectedChild?: number; payNotice?: 'paid' | 'pending' | 'fail' }) {
  try {
    return await PortalViewContent(props);
  } catch (error) {
    if (!isTransientDatabaseError(error)) throw error;
    console.error('[portal] database temporarily unavailable', error);
    return (
      <div className="ptl-card" role="alert" style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: 14, color: 'var(--mut)' }}>
          {props.lang === 'ar'
            ? 'تعذّر تحميل بوابة العائلة مؤقتاً. بياناتك محفوظة، يرجى المحاولة مرة أخرى.'
            : 'The family portal is temporarily unavailable. Your data is safe; please try again.'}
        </p>
        <Link className="btn b" style={{ padding: '12px 26px', fontSize: 15 }} href={props.lang === 'ar' ? '/portal' : '/en/portal'}>
          {props.lang === 'ar' ? 'إعادة المحاولة' : 'Try again'}
        </Link>
      </div>
    );
  }
}

async function PortalViewContent({ lang, familyId, selectedChild, payNotice }: { lang: Lang; familyId: number; selectedChild?: number; payNotice?: 'paid' | 'pending' | 'fail' }) {
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

  const selected = selectedChild === undefined ? students[0] : students.find((s) => s.id === selectedChild);
  if (!selected) {
    return (
      <div className="ptl-card" role="alert" style={{ textAlign: 'center' }}>
        <p style={{ marginBottom: 14, color: 'var(--mut)' }}>
          {lang === 'ar' ? 'تعذّر العثور على الطفل المحدد في حساب عائلتك.' : 'The selected child was not found in your family account.'}
        </p>
        <Link className="btn b" style={{ padding: '12px 26px', fontSize: 15 }} href={`${base}/portal`}>
          {lang === 'ar' ? 'عرض أطفال العائلة' : 'View family children'}
        </Link>
      </div>
    );
  }
  const child = selected;
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
      include: {
        session: { include: { courseRun: { include: { program: true } } } },
        makeupSession: { include: { courseRun: { include: { program: true } } } },
      },
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
  const progName = (p: { nameAr: string; nameEn: string }) => p.nameEn;
  const statusLabel: Record<string, string> = {
    active: d.statusActive, pending: d.statusPending, paused: d.statusPaused, cancelled: d.statusCancelled,
  };
  const attLabel: Record<string, string> = { present: d.present, absent: d.absent, late: d.late, excused: d.excused };
  const mkLabel: Record<string, string> = { pending: d.mkPending, approved: d.mkApproved, rejected: d.mkRejected };
  const makeupBySession = new Map(makeupRequests.map((m) => [m.sessionId, m]));

  // Approved makeup slots join the child's upcoming calendar alongside regular sessions.
  const upcomingIds = new Set(upcoming.map((s) => s.id));
  const makeupUpcoming = makeupRequests
    .filter((m) => m.status === 'approved' && m.makeupSession && m.makeupSession.status === 'scheduled' && m.makeupSession.date >= now && !upcomingIds.has(m.makeupSession.id))
    .map((m) => ({ ...m.makeupSession!, isMakeup: true }));
  const allUpcoming = [...upcoming.map((s) => ({ ...s, isMakeup: false })), ...makeupUpcoming]
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // Nearest upcoming session (regular or approved makeup) for the hero card.
  const next = allUpcoming[0];
  const nextJoinUrl = next ? joinUrlFor(next) : null;
  const todayRiyadh = riyadhDay(now);
  const nextIsToday = next ? riyadhDay(next.date) === todayRiyadh : false;
  const nextWhen = next
    ? nextIsToday
      ? d.nextToday
      : riyadhDay(next.date) === riyadhDay(new Date(now.getTime() + 86400000))
        ? d.nextTomorrow
        : fmtDate(lang, next.date)
    : '';

  // Family appointments (trial classes & consultations) are matched by the
  // account phone number — they may predate the family account itself.
  const family = await prisma.family.findUnique({ where: { id: familyId } });
  const appointments = family
    ? await prisma.appointment.findMany({
        where: { phone: family.phone, status: 'scheduled', startsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        take: 6,
      })
    : [];
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

      {/* Learning platform CTA */}
      <Link
        href={lang === 'ar' ? '/learn' : '/en/learn'}
        className="ptl-card"
        style={{
          display: 'flex', alignItems: 'center', gap: 14, textDecoration: 'none',
          background: 'linear-gradient(135deg,#1C54CB,#22DAFF 220%)', color: '#fff',
          borderRadius: 14, padding: '16px 20px', marginBottom: 0,
        }}
      >
        <span style={{ fontSize: 36 }}>🎓</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{lang === 'ar' ? 'منصة التعلّم' : 'Learning platform'}</div>
          <div style={{ fontSize: 13, opacity: .85, marginTop: 2 }}>
            {lang === 'ar' ? 'دروس، تمارين، XP وشارات — ابدأ الآن!' : 'Lessons, activities, XP and badges — start learning!'}
          </div>
        </div>
        <span style={{ marginInlineStart: 'auto', fontSize: 20 }}>{lang === 'ar' ? '←' : '→'}</span>
      </Link>

      {/* next session hero */}
      <div className="ptl-card ptl-next">
        <div className="hd">
          <span className="ico" aria-hidden>{next ? '🎥' : '📅'}</span>
          <span className="ttl">{d.nextTitle}</span>
          {next && <span className={`ptl-next-when ${nextIsToday ? 'today' : ''}`}>{nextWhen}</span>}
          {allUpcoming.length > 1 && <a className="all" href="#upcoming">{d.nextAll} ({fmt(lang, allUpcoming.length)})</a>}
        </div>
        {next ? (
          <div className="bd">
            <div className="info">
              <div className="nm">
                {progName(next.courseRun.program)}
                {next.isMakeup && <span className="ptl-mk approved" style={{ marginInlineStart: 8 }}>🔁 {d.mkTag}</span>}
              </div>
              <div className="mt">
                {child.firstName} · {weekdays[next.courseRun.weekday]} {fmt(lang, next.courseRun.time)} · {fmtDate(lang, next.date)}
                {' · '}
                {next.courseRun.format === 'online' ? `💻 ${d.online}` : `📍 ${next.courseRun.location ?? d.inPerson}`}
              </div>
            </div>
            {nextJoinUrl && (
              <a className="ptl-live lg" href={nextJoinUrl} target="_blank" rel="noopener noreferrer">
                🎥 {d.joinLive}
              </a>
            )}
          </div>
        ) : (
          <p className="ptl-next-empty">
            {d.nextNone}
            {enrollments.length === 0 && (
              <Link className="btn y" style={{ padding: '8px 20px', fontSize: 13 }} href={`${base}/enroll`}>{d.goEnroll}</Link>
            )}
          </p>
        )}
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

      {/* appointments (trial / consultation meetings) */}
      {appointments.length > 0 && (
        <div className="ptl-card">
          <h3><span className="ico">🗓️</span>{d.appointments}</h3>
          {appointments.map((a) => (
            <div key={a.id} className="ptl-enr">
              <div className="info">
                <div className="nm">
                  {a.kind === 'trial' ? d.apptTrial : d.apptConsult}
                  {a.childFirstName ? ` — ${a.childFirstName}` : ''}
                </div>
                <div className="mt">{formatRiyadh(a.startsAt, lang)}</div>
              </div>
              {a.meetUrl && (
                <a className="btn b" style={{ padding: '8px 18px', fontSize: 13 }} href={a.meetUrl} target="_blank" rel="noopener noreferrer">
                  {d.apptJoin}
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* upcoming sessions */}
      <div className="ptl-card" id="upcoming">
        <h3><span className="ico">📅</span>{d.upcoming}</h3>
        {allUpcoming.length === 0 ? (
          <div className="ptl-empty">{d.noUpcoming}</div>
        ) : (
          allUpcoming.map((s) => {
            const joinUrl = joinUrlFor(s);
            return (
              <div key={s.id} className="ptl-sess">
                <span className="d">{fmtDate(lang, s.date)}</span>
                <span className="p">
                  {progName(s.courseRun.program)} — {weekdays[s.courseRun.weekday]} {fmt(lang, s.courseRun.time)}
                  {s.isMakeup && <span className="ptl-mk approved" style={{ marginInlineStart: 8 }}>🔁 {d.mkTag}</span>}
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
      {recorded.some((session) => safeExternalUrl(session.recordingUrl)) && (
        <div className="ptl-card">
          <h3><span className="ico">🎬</span>{d.recordings}</h3>
          {recorded.map((s) => {
            const recordingUrl = safeExternalUrl(s.recordingUrl);
            if (!recordingUrl) return null;
            return (
              <div key={s.id} className="ptl-sess">
                <span className="d">{fmtDate(lang, s.date)}</span>
                <span className="p">{progName(s.courseRun.program)}</span>
                <a className="ptl-rec" href={recordingUrl} target="_blank" rel="noopener noreferrer">
                  ▶️ {d.watchRecording}
                </a>
              </div>
            );
          })}
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
                {m.makeupSession && (
                  <span className="loc">
                    🔁 {d.mkSlot}: {fmtDate(lang, m.makeupSession.date)} — {weekdays[m.makeupSession.courseRun.weekday]} {fmt(lang, m.makeupSession.courseRun.time)}
                    {m.makeupSession.courseRun.format === 'online' ? ` · 💻 ${d.online}` : m.makeupSession.courseRun.location ? ` · 📍 ${m.makeupSession.courseRun.location}` : ''}
                  </span>
                )}
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
      <PaymentsSection lang={lang} familyId={familyId} d={d} payNotice={payNotice} />

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
  const progName = (p: { nameAr: string; nameEn: string }) => p.nameEn;
  const available = await paymentAvailability();

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
            <RenewButton lang={lang} enrollmentId={e.id} amountSar={amount} live={{ moyasar: moyasarLive(), tamara: tamaraLive() }} available={available} />
          </div>
        );
      })}
    </div>
  );
}

async function PaymentsSection({ lang, familyId, d, payNotice }: { lang: Lang; familyId: number; d: (typeof portalDict)['ar']; payNotice?: 'paid' | 'pending' | 'fail' }) {
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
  const progName = (p: { nameAr: string; nameEn: string }) => p.nameEn;
  const available = await paymentAvailability();

  return (
    <div className="ptl-card">
      <h3><span className="ico">💳</span>{d.payments}</h3>

      {payNotice && (
        <div
          role="status"
          style={{
            margin: '10px 0 14px',
            padding: '10px 14px',
            borderRadius: 10,
            fontSize: 14,
            fontWeight: 600,
            background: payNotice === 'paid' ? '#e8f7ee' : payNotice === 'pending' ? '#fff7e0' : '#fdeaea',
            color: payNotice === 'paid' ? '#146c3c' : payNotice === 'pending' ? '#8a6d00' : '#a12622',
          }}
        >
          {payNotice === 'paid' ? d.payOk : payNotice === 'pending' ? d.payPending : d.payFail}
        </div>
      )}

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
                  <RenewButton lang={lang} enrollmentId={e.id} amountSar={amount} live={{ moyasar: moyasarLive(), tamara: tamaraLive() }} available={available} />
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
              {p.status === 'refunded' && <span className="ptl-tag" style={{ marginInlineStart: 8, background: '#EFE7FD', color: '#6B3FD1' }}>{d.refundedPay}</span>}
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
