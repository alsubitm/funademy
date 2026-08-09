import Link from 'next/link';
import { ScrollReveal } from '@/components/ScrollReveal';

type Card = { icon: string; title: string; desc: string; href: string };

const CARDS: Record<'ar' | 'en', { kick: string; title: string; sub: string; cards: Card[] }> = {
  ar: {
    kick: 'منصاتنا',
    title: 'كل خدمات FunAdemy في مكان واحد',
    sub: 'من الحجز الأول حتى متابعة تقدّم طفلك — هذه بواباتك السريعة.',
    cards: [
      { icon: '👨‍👩‍👧', title: 'بوابة الأهالي', desc: 'الاشتراكات، الحضور، المدفوعات، وتقارير الأبناء', href: '/portal' },
      { icon: '🚀', title: 'منصة تعلّم الأطفال', desc: 'دروس تفاعلية ونقاط وأوسمة لكل طفل مشترك', href: '/learn' },
      { icon: '🗓️', title: 'حجز مقعد', desc: 'احجز مقعد طفلك في الدورات والحصص القادمة', href: '/book' },
      { icon: '🧩', title: 'الاشتراك الشهري', desc: 'سجّل في برنامج شهري مستمر يناسب عمر طفلك', href: '/enroll' },
      { icon: '🎓', title: 'استشارة مجانية', desc: 'جلسة تعريفية مع معلّم لاختيار البرنامج المناسب', href: '/consult' },
      { icon: '📰', title: 'المدونة', desc: 'مقالات للأهالي عن الهندسة والبرمجة للأطفال', href: '/blog' },
      { icon: '🇸🇦', title: 'حملة وطنّونا', desc: 'أطفالنا يبنون وطننا — شارك بمكعّبك في جدار الوطن', href: '/watanona' },
      { icon: '💬', title: 'تواصل معنا', desc: 'واتساب، هاتف، وبريد — نرد عليك بسرعة', href: '/contact' },
    ],
  },
  en: {
    kick: 'OUR PLATFORMS',
    title: 'All of FunAdemy in one place',
    sub: 'From your first booking to tracking your child’s progress — quick doors to everything.',
    cards: [
      { icon: '👨‍👩‍👧', title: 'Parent portal', desc: 'Subscriptions, attendance, payments & progress reports', href: '/en/portal' },
      { icon: '🚀', title: 'Kids learning platform (Arabic)', desc: 'Interactive lessons, XP and badges for enrolled kids', href: '/learn' },
      { icon: '🗓️', title: 'Book a seat', desc: 'Reserve your child’s seat in upcoming classes', href: '/en/book' },
      { icon: '🧩', title: 'Monthly enrollment', desc: 'Join an ongoing monthly program that fits their age', href: '/en/enroll' },
      { icon: '🎓', title: 'Free consultation', desc: 'An intro session with a teacher to pick the right program', href: '/en/consult' },
      { icon: '📰', title: 'Blog', desc: 'Articles for parents on kids engineering & coding', href: '/en/blog' },
      { icon: '🇸🇦', title: 'Watanona campaign', desc: 'Our Kids Build Our Homeland — place your brick', href: '/en/watanona' },
      { icon: '💬', title: 'Contact us', desc: 'WhatsApp, phone and email — quick replies', href: '/en/contact' },
    ],
  },
};

/** Quick-access grid to every FunAdemy platform/service — home §platforms. */
export function Platforms({ lang }: { lang: 'ar' | 'en' }) {
  const d = CARDS[lang];
  return (
    <section className="platforms" id="platforms">
      <div className="wrap">
        <ScrollReveal>
          <span className="kick">{d.kick}</span>
          <h2>{d.title}</h2>
          <p className="sub">{d.sub}</p>
        </ScrollReveal>
        <div className="plat-grid">
          {d.cards.map((c) => (
            <Link key={c.href} href={c.href} className="plat-card">
              <span className="plat-icon" aria-hidden="true">{c.icon}</span>
              <span className="plat-txt">
                <strong>{c.title}</strong>
                <small>{c.desc}</small>
              </span>
              <span className="plat-arrow" aria-hidden="true">{lang === 'ar' ? '←' : '→'}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
