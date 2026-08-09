import { dict } from '@/lib/i18n';
import { LICENSE_NO } from '@/lib/constants';
import Image from 'next/image';

export function Hero({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];

  return (
    <header className="hero">
      <div className="bpgrid"></div>
      <div className="wrap hero-in">
        <div style={{ zIndex: 5 }}>
          <div className="lic">LICENSE № {LICENSE_NO} · e² YOUNG ENGINEERS</div>
          {lang === 'ar' ? (
            <>
              <h1 className="ar" style={{ color: '#fff', marginTop: 0 }}>
                لا نعلّم أطفالنا عن الهندسة —<br />
                <span className="y">بل نصنع منهم</span> <span className="u">مهندسين.</span>
              </h1>
              <p className="lead">
                ميكانيكا، روبوتات، وبرمجة حقيقية مبنية على LEGO® للأعمار ٤-١٨ — حصص مباشرة بالعربية، أونلاين من منزلك أينما كنت.
              </p>
              <div className="ar" style={{ fontFamily: 'var(--font-mono)' }}>
                We don't teach kids about engineering. We make them engineers.
              </div>
            </>
          ) : (
            <>
              <h1>
                We don't teach kids about engineering.<br />
                <span className="y">We make them</span> <span className="u">engineers.</span>
              </h1>
              <p className="lead">
                LEGO®-based mechanics, robotics and real coding for ages 4–18 — live online classes in Arabic, from the comfort of your home.
              </p>
              <div className="ar" style={{ fontFamily: 'var(--font-mono)' }}>نصنع مهندسين صغار — أونلاين</div>
            </>
          )}

          <div className="hcta">
            <a className="btn y" href="#pricing">
              {d.navTrial}
            </a>
            <a className="btn ghost" href="#path">
              {d.navPath}
            </a>
          </div>
          <div className="hticks">
            <span>{lang === 'ar' ? 'حصص مباشرة دائماً' : 'Always live classes'}</span>
            <span>{lang === 'ar' ? 'مدربون معتمدون' : 'Certified instructors'}</span>
            <span>{lang === 'ar' ? 'الأعمار ٤-١٨' : 'Ages 4–18'}</span>
          </div>
        </div>

        <div className="photo-frame">
          <div className="img-wrap">
            <Image src="/hero-kids.jpg" alt="Children building robotics" fill priority style={{ objectFit: 'cover' }} />
            <div className="glow"></div>
          </div>
          <div className="floating-badge">
            <div className="icon">🚀</div>
            <div className="text">
              <b>100%</b>
              <span>{lang === 'ar' ? 'متعة التعلم' : 'Fun Learning'}</span>
            </div>
          </div>
          <div className="floating-badge" style={{ top: '-20px', bottom: 'auto', right: '-20px', left: 'auto', animationDelay: '-3s' }}>
            <div className="icon" style={{ background: 'rgba(255, 202, 23, 0.15)', color: 'var(--yellow)' }}>⭐</div>
            <div className="text">
              <b>{lang === 'ar' ? 'معتمد' : 'Certified'}</b>
              <span>e² Young Engineers</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}