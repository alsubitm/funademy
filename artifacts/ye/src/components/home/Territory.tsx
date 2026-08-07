import { ScrollReveal } from '@/components/ScrollReveal';

export function Territory({ lang }: { lang: 'ar' | 'en' }) {
  const nb = ['الياسمين', 'النرجس', 'الصحافة', 'الندى', 'النفل', 'الفلاح', 'الغدير', 'التعاون', 'حي الملك سلمان'];
  const nbEn = ['Al Yasmin', 'An Narjis', 'Al Sahafah', 'An Nada', 'An Nafal', 'Al Falah', 'Al Ghadir', 'At Taawun', 'King Salman Nbhd'];
  
  const list = lang === 'ar' ? nb : nbEn;

  return (
    <section className="bg-sand-1" id="territory" style={{ background: '#F5F8FF' }}>
      <div className="wrap split">
        <ScrollReveal>
          <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>
            LICENSED TERRITORY · FALCON EYE LTD
          </span>
          {lang === 'ar' ? (
            <>
              <h2>بفخر نخدم شمال الرياض</h2>
              <p className="sub">
                بصفتنا الوكيل المعتمد حصرياً لمنطقة شمال الرياض، نحن ملتزمون بتقديم معايير e² Young Engineers العالمية لأطفالكم.
              </p>
            </>
          ) : (
            <>
              <h2>Proudly serving North Riyadh</h2>
              <p className="sub">
                As the officially licensed partner for the North Riyadh territory, we are committed to bringing the global standard of e² Young Engineers to your neighborhood.
              </p>
            </>
          )}
          <div className="terr" dir="rtl">
            {/* Displaying neighborhoods in RTL layout normally looks fine in both langs, but we can do ltr if en */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
              {list.map((n, i) => (
                <span className="nb" key={i}>{n}</span>
              ))}
              <span className="nb" style={{ background: 'var(--blue)', color: '#fff', borderColor: 'var(--blue)' }}>
                {lang === 'ar' ? '+ والمزيد' : '+ and more'}
              </span>
            </div>
          </div>
        </ScrollReveal>

        <ScrollReveal className="cert" dir="ltr">
          <div className="ch">e² YOUNG ENGINEERS</div>
          <h3>CERTIFICATE OF LICENSE</h3>
          <p>This is to certify that</p>
          <div className="nm">Falcon Eye Ltd.</div>
          <p>is the official licensed partner for</p>
          <h4 style={{ textAlign: 'center', marginTop: '4px', fontSize: '15px' }}>RIYADH NORTH TERRITORY</h4>
          <div className="foot2">
            <span>ISSUED: 2024</span>
            <span>LIC: 4030388340</span>
          </div>
          <svg className="seal" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="46" fill="#FFC400" />
            <circle cx="50" cy="50" r="38" fill="none" stroke="#101A38" strokeWidth="2" strokeDasharray="4 4" />
            <path d="M50 30 l6 14 14 6 -14 6 -6 14 -6 -14 -14 -6 14 -6z" fill="#101A38" />
          </svg>
        </ScrollReveal>
      </div>
    </section>
  );
}
