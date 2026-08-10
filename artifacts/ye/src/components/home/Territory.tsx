import { ScrollReveal } from '@/components/ScrollReveal';

export function Territory({ lang }: { lang: 'ar' | 'en' }) {
  return (
    <section className="sec bg-sand-1" id="accreditation">
      <div className="wrap split">
        <ScrollReveal>
          <span className="kick">
            FALCON EYE LTD
          </span>
          {lang === 'ar' ? (
            <>
              <h2>بفخر نخدم أطفالنا أينما كانوا</h2>
              <p className="sub">
                بصفتنا الوكيل المعتمد لبرامج e² Young Engineers، نحن ملتزمون بتقديم معاييرها العالمية لأطفالكم — أونلاين للجميع من أي مكان.
              </p>
            </>
          ) : (
            <>
              <h2>Proudly serving families everywhere</h2>
              <p className="sub">
                As an officially licensed e² Young Engineers partner, we are committed to bringing its global standard to your family — online for everyone, from anywhere.
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
          <h4 style={{ textAlign: 'center', marginTop: '4px', fontSize: '15px' }}>SAUDI ARABIA</h4>
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
