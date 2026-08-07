import { ScrollReveal } from '@/components/ScrollReveal';

export function Territory({ lang }: { lang: 'ar' | 'en' }) {
  return (
    <section className="bg-sand-1" id="accreditation">
      <div className="wrap split">
        <ScrollReveal>
          <span className="kick">
            FALCON EYE LTD
          </span>
          {lang === 'ar' ? (
            <>
              <h2>بفخر نخدم الرياض</h2>
              <p className="sub">
                بصفتنا الوكيل المعتمد لمدينة الرياض، نحن ملتزمون بتقديم معايير e² Young Engineers العالمية لأطفالكم — أونلاين للجميع.
              </p>
            </>
          ) : (
            <>
              <h2>Proudly serving Riyadh</h2>
              <p className="sub">
                As the officially licensed partner for Riyadh, we are committed to bringing the global standard of e² Young Engineers to your family — online for everyone.
              </p>
            </>
          )}
        </ScrollReveal>

        <ScrollReveal className="cert" dir="ltr">
          <div className="ch">e² YOUNG ENGINEERS</div>
          <h3>CERTIFICATE OF LICENSE</h3>
          <p>This is to certify that</p>
          <div className="nm">Falcon Eye Ltd.</div>
          <p>is the official licensed partner for</p>
          <h4 style={{ textAlign: 'center', marginTop: '4px', fontSize: '15px' }}>RIYADH</h4>
          <div className="foot2">
            <span>ISSUED: 2024</span>
            <span>LIC: 4030388340</span>
          </div>
          <svg className="seal" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="#FFCA17" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#101A38" strokeWidth="2" strokeDasharray="4 4" />
            <path d="M50 30 l6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 14 -6z" fill="#101A38" />
          </svg>
        </ScrollReveal>
      </div>
    </section>
  );
}
