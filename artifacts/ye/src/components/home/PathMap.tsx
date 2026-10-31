import { dict } from '@/lib/i18n';
import { ScrollReveal } from '@/components/ScrollReveal';
import Link from 'next/link';

/** 7 stations in age order — finish flag at AlgoC (Master Spec). */
const STATIONS = [
  { slug: 'big-builders', nameAr: 'البنّاؤون الصغار', nameEn: 'Big Builders', ages: '4–6', icon: 'E', fill: 'var(--yellow)', x: 60, y: 250 },
  { slug: 'smartivo', nameAr: 'سمارتيفو', nameEn: 'Smartivo', ages: '4–6', icon: 'T', fill: 'var(--cyan)', x: 250, y: 110 },
  { slug: 'bricks-challenge', nameAr: 'تحدي المكعبات', nameEn: 'Bricks Challenge', ages: '6–10', icon: 'E', fill: '#E5AE4A', x: 440, y: 250 },
  { slug: 'algoplay', nameAr: 'ألجوبلاي', nameEn: 'AlgoPlay', ages: '6–10', icon: 'T', fill: 'var(--blue)', x: 630, y: 110 },
  { slug: 'galileo-technic', nameAr: 'غاليليو تكنيك', nameEn: 'Galileo Technic', ages: '7–10', icon: 'S', fill: 'var(--red)', x: 820, y: 250 },
  { slug: 'robotoys', nameAr: 'روبوتويز', nameEn: 'RoboToys', ages: '9–12', icon: 'T', fill: 'var(--blue-deep, #11388E)', x: 1010, y: 110 },
  { slug: 'algoc', nameAr: 'ألجو سي', nameEn: 'AlgoC', ages: '13–18', icon: 'T', fill: 'var(--ink)', x: 1170, y: 210 },
];

const ROAD =
  'M60 250 C 155 250 155 110 250 110 C 345 110 345 250 440 250 C 535 250 535 110 630 110 C 725 110 725 250 820 250 C 915 250 915 110 1010 110 C 1090 110 1130 160 1170 210';

export function PathMap({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];

  return (
    <section className="sec path-sec" id="path">
      <div className="bpgrid light"></div>
      <div className="wrap" style={{ position: 'relative' }}>
        <ScrollReveal style={{ textAlign: 'center' }}>
          <span className="kick">
            THE ENGINEERING PATH · 4 → 18
          </span>
          {lang === 'ar' ? (
            <>
              <h2>مسار واحد — من أول مكعّب إلى أول سطر برمجة</h2>
              <div className="arsub">One path from first brick to first code</div>
              <p className="sub" style={{ margin: '0 auto' }}>
                كل برنامج يفتح الباب للبرنامج الذي يليه — رحلة يمكن لطفلك البدء فيها في أي عمر من ٤ إلى ١٨.
              </p>
            </>
          ) : (
            <>
              <h2>One path from first brick to first code</h2>
              <div className="arsub">مسار واحد — من أول مكعّب إلى أول سطر برمجة</div>
              <p className="sub" style={{ margin: '0 auto' }}>
                Each program unlocks the next — a journey your child can start at any age from 4 to 18.
              </p>
            </>
          )}
        </ScrollReveal>

        <div className="pathmap" dir="ltr">
          <svg viewBox="0 0 1240 340">
            <path d={ROAD} fill="none" stroke="#C9D6F2" strokeWidth="14" strokeLinecap="round" />
            <path d={ROAD} fill="none" stroke="#1C54CB" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 14" />
            <g fontFamily="var(--font-display)" fontWeight="800" textAnchor="middle">
              {STATIONS.map((s) => {
                const above = s.y < 200;
                return (
                  <g key={s.slug} transform={`translate(${s.x},${s.y})`}>
                    <a href={lang === 'ar' ? `/programs/${s.slug}` : `/en/programs/${s.slug}`}>
                      <circle r="30" fill={s.fill} stroke="var(--ink)" strokeWidth="5" style={{ cursor: 'pointer' }} />
                      <text y="9" fontSize="26">{s.icon}</text>
                      <text y={above ? -44 : 56} fontSize="15" fill="var(--ink)">
                        {s.nameEn}
                      </text>
                      <text y={above ? -26 : 74} fontSize="11.5" fontFamily="var(--font-mono)" fontWeight="600" fill="var(--mut)">
                        AGES {s.ages}
                      </text>
                    </a>
                  </g>
                );
              })}
              {/* finish flag at AlgoC */}
              <g transform="translate(1170,150)">
                <line x1="0" y1="0" x2="0" y2="34" stroke="var(--ink)" strokeWidth="4" />
                <path d="M0 0 L34 8 L0 16Z" fill="var(--yellow)" stroke="var(--ink)" strokeWidth="3" />
              </g>
            </g>
          </svg>
        </div>

        <div className="legend">
          <span><i style={{ background: '#1C54CB' }}></i>{d.legendOnline}</span>
          <span><i style={{ background: '#C9D6F2' }}></i>{d.legendPathContinues}</span>
        </div>
      </div>
    </section>
  );
}
