import Link from 'next/link';
import { prefix, type Lang } from './shared';

const COPY = {
  en: {
    eyebrow: 'JANUARY 2027, IN PREPARATION',
    title1: 'Live classes,',
    title2: 'from your living room.',
    body: 'FunAdemy is preparing its first online course: small groups, a real tutor on screen, and hands-on engineering, coding and robotics challenges. For groups and prices available now, visit the enrolment page.',
    points: ['Small live groups with a tutor', 'Arabic first, with English available', 'Join from home in Riyadh'],
    status: 'January 2027 course in preparation',
    linkTitle: 'See current groups and prices',
    linkDescription: 'Open the enrolment page for available programmes.',
  },
  ar: {
    eyebrow: 'يناير 2027، قيد التجهيز',
    title1: 'حصص مباشرة،',
    title2: 'من صالة بيتكم.',
    body: 'تجهّز FunAdemy أول دورة أونلاين: مجموعات صغيرة، ومدرّب حقيقي على الشاشة، وتحديات عملية في الهندسة والبرمجة والروبوتات. وللمجموعات والأسعار المتاحة الآن، زر صفحة التسجيل.',
    points: ['مجموعات صغيرة مباشرة مع مدرّب', 'بالعربي أولًا، والإنجليزية متاحة', 'حضور من البيت في الرياض'],
    status: 'دورة يناير 2027 قيد التجهيز',
    linkTitle: 'المجموعات والأسعار الحالية',
    linkDescription: 'انتقل إلى صفحة التسجيل للاطّلاع على البرامج المتاحة.',
  },
} as const;

export function OnlineCourse({ lang }: { lang: Lang }) {
  const c = COPY[lang];
  return (
    <section className="sec online-course section-wrap" id="online" aria-labelledby="online-title">
      <div className="sand-divider" aria-hidden="true" />
      <div className="online-grid">
        <div className="online-copy reveal">
          <p className="eyebrow"><span className="online-dot" aria-hidden="true" /> <span>{c.eyebrow}</span></p>
          <h2 id="online-title"><span>{c.title1}</span><br /><span className="highlight">{c.title2}</span></h2>
          <p>{c.body}</p>
          <ul className="online-points">{c.points.map((pt) => <li key={pt}><span aria-hidden="true">✦</span><span>{pt}</span></li>)}</ul>
          <p className="online-status" data-testid="status-registration"><span aria-hidden="true" />{c.status}</p>
        </div>
        <div className="online-links reveal">
          <Link href={prefix(lang, '/enroll')} className="online-link is-primary" data-testid="link-online-enroll">
            <span className="online-link-num" aria-hidden="true">↗</span>
            <span className="online-link-text"><b>{c.linkTitle}</b><small>{c.linkDescription}</small></span>
          </Link>
        </div>
      </div>
      <div className="sand-divider" aria-hidden="true" />
    </section>
  );
}
