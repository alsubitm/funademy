import { dict } from '@/lib/i18n';
import { ScrollReveal } from '@/components/ScrollReveal';
import Image from 'next/image';

export function Pricing({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];

  return (
    <section className="price" id="pricing">
      <div style={{ position: 'absolute', inset: 0, opacity: 0.15, mixBlendMode: 'overlay', pointerEvents: 'none' }}>
        <Image src="/pattern-bricks.jpg" alt="" fill style={{ objectFit: 'cover' }} />
      </div>
      <div className="wrap" style={{ position: 'relative', zIndex: 2 }}>
        <ScrollReveal style={{ textAlign: 'center' }}>
          <span className="kick" style={{ color: 'var(--yellow)', borderColor: 'rgba(255,202,23,0.3)', background: 'rgba(255,202,23,0.1)' }}>
            PRICING & REGISTRATION
          </span>
          {lang === 'ar' ? (
            <>
              <h2>{d.pricingTitle}</h2>
              <div className="arsub">{d.pricingSub}</div>
            </>
          ) : (
            <>
              <h2>{d.pricingTitle}</h2>
              <div className="arsub">استثمر في مستقبلهم الهندسي</div>
            </>
          )}
        </ScrollReveal>

        <div className="plans">
          {/* Online Plan */}
          <ScrollReveal className="plan hot" style={{ transitionDelay: '100ms' }}>
            <div className="t">{lang === 'ar' ? 'مباشر مع المدرب' : 'LIVE WITH INSTRUCTOR'}</div>
            <div className="inner">
              <h3>{lang === 'ar' ? 'أونلاين' : 'Online'}</h3>
              <div className="pr">
                <small>SAR</small> 1380 <small>{lang === 'ar' ? '/ للبرنامج' : '/ program'}</small>
              </div>
              <ul dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <li>{lang === 'ar' ? '٤-٦ حصص شهرياً' : '4–6 sessions per month'}</li>
                <li>{lang === 'ar' ? 'عدد طلاب محدود (٤-٨)' : 'Small groups (4-8 kids)'}</li>
                <li>{lang === 'ar' ? 'العدة تُشحن للمنزل' : 'Kit shipped to home'}</li>
                <li>{lang === 'ar' ? 'بيئة تفاعلية اجتماعية' : 'Interactive social environment'}</li>
                <li>{lang === 'ar' ? 'متابعة وتواصل مستمر' : 'Continuous follow-up'}</li>
              </ul>
              <a className="btn y" style={{ width: '100%', justifyContent: 'center' }} href="/book">
                {d.navTrial}
              </a>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal className="pnote">
          {lang === 'ar' ? 'السعر ١٣٨٠ ريال للطفل الواحد بمعدل ٤-٦ حصص شهرياً. خصم ١٠٪ للأخوة.' : 'SAR 1380 per child, at 4–6 sessions per month. 10% sibling discount.'}
          {' '}
          <a href={lang === 'ar' ? '/enroll' : '/en/enroll'} style={{ color: 'var(--yellow)', fontWeight: 700, textDecoration: 'underline' }}>
            {lang === 'ar' ? 'سجّل الآن' : 'Enroll now'}
          </a>
        </ScrollReveal>
      </div>
    </section>
  );
}