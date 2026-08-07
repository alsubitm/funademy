import { dict } from '@/lib/i18n';
import { ScrollReveal } from '@/components/ScrollReveal';

export function Pricing({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];

  return (
    <section className="price" id="pricing">
      <div className="wrap">
        <ScrollReveal style={{ textAlign: 'center' }}>
          <span className="kick" style={{ color: 'var(--yellow)', borderColor: 'var(--yellow)' }}>
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
          <ScrollReveal className="plan" style={{ transitionDelay: '100ms' }}>
            <div className="inner">
              <h3>{lang === 'ar' ? 'أونلاين مباشر' : 'Live Online'}</h3>
              <div className="pr">
                <small>SAR</small> 330 <small>{lang === 'ar' ? '/ شهر' : '/ mo'}</small>
              </div>
              <ul dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <li>{lang === 'ar' ? 'حصص أسبوعية مباشرة' : 'Weekly live sessions'}</li>
                <li>{lang === 'ar' ? 'عدد طلاب محدود (٤-٨)' : 'Small groups (4-8 kids)'}</li>
                <li>{lang === 'ar' ? 'العدة تُشحن للمنزل' : 'Kit shipped to home'}</li>
                <li>{lang === 'ar' ? 'متابعة وتواصل مستمر' : 'Continuous follow-up'}</li>
              </ul>
              <a className="btn b" style={{ width: '100%', justifyContent: 'center' }} href="/book">
                {d.navTrial}
              </a>
            </div>
          </ScrollReveal>

          {/* In-Person Plan */}
          <ScrollReveal className="plan hot" style={{ transitionDelay: '200ms' }}>
            <div className="t">{lang === 'ar' ? 'الأكثر طلباً' : 'MOST POPULAR'}</div>
            <div className="inner">
              <h3>{lang === 'ar' ? 'حضوري' : 'In-Person'}</h3>
              <div className="pr">
                <small>SAR</small> 380 <small>{lang === 'ar' ? '/ شهر' : '/ mo'}</small>
              </div>
              <ul dir={lang === 'ar' ? 'rtl' : 'ltr'}>
                <li>{lang === 'ar' ? 'في مراكزنا بالرياض' : 'At our Riyadh centers'}</li>
                <li>{lang === 'ar' ? 'بيئة تفاعلية اجتماعية' : 'Interactive social environment'}</li>
                <li>{lang === 'ar' ? 'العدة متوفرة بالمركز' : 'Kit provided at center'}</li>
                <li>{lang === 'ar' ? 'تنمية مهارات العمل الجماعي' : 'Teamwork skill building'}</li>
              </ul>
              <a className="btn y" style={{ width: '100%', justifyContent: 'center' }} href="/book">
                {d.navTrial}
              </a>
            </div>
          </ScrollReveal>
        </div>

        <ScrollReveal className="pnote">
          {lang === 'ar' ? 'خصم ١٠٪ للأخوة. تُدفع الرسوم كدفعة واحدة للفصل الدراسي (١٢ أسبوع).' : '10% sibling discount. Fees are paid as a single payment per semester (12 weeks).'}
        </ScrollReveal>
      </div>
    </section>
  );
}
