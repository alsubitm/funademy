import { dict } from '@/lib/i18n';
import { ScrollReveal } from '@/components/ScrollReveal';

export function PathMap({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];

  return (
    <section className="path-sec" id="path">
      <div className="bpgrid light"></div>
      <div className="wrap" style={{ position: 'relative' }}>
        <ScrollReveal style={{ textAlign: 'center' }}>
          <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>
            THE ENGINEERING PATH · 4 → 18
          </span>
          {lang === 'ar' ? (
            <>
              <h2>مسار واحد — من أول مكعّب إلى أول سطر برمجة</h2>
              <div className="arsub">One path from first brick to first code</div>
              <p className="sub" style={{ margin: '0 auto' }}>
                كل برنامج يفتح الباب للبرنامج الذي يليه — رحلة تمتد لـ 10 سنوات يمكن لطفلك البدء فيها في أي عمر.
              </p>
            </>
          ) : (
            <>
              <h2>One path from first brick to first code</h2>
              <div className="arsub">مسار واحد — من أول مكعّب إلى أول سطر برمجة</div>
              <p className="sub" style={{ margin: '0 auto' }}>
                Each program unlocks the next — a 10-year journey your child can start at any age.
              </p>
            </>
          )}
        </ScrollReveal>

        <div className="pathmap" dir="ltr">
          <svg viewBox="0 0 1100 330">
            {/* snaking path */}
            <path
              d="M60 250 C 200 250 200 110 340 110 C 470 110 470 250 600 250 C 730 250 730 110 860 110 C 950 110 1000 160 1040 200"
              fill="none" stroke="#C9D6F2" strokeWidth="14" strokeLinecap="round"
            />
            <path
              d="M60 250 C 200 250 200 110 340 110 C 470 110 470 250 600 250 C 730 250 730 110 860 110 C 950 110 1000 160 1040 200"
              fill="none" stroke="#2764D6" strokeWidth="5" strokeLinecap="round" strokeDasharray="2 14"
            />
            {/* stations */}
            <g fontFamily="var(--font-display)" fontWeight="800" textAnchor="middle">
              <g transform="translate(60,250)">
                <circle r="30" fill="#FFC400" stroke="#101A38" strokeWidth="5" />
                <text y="9" fontSize="26">🧱</text>
                <text y="56" fontSize="15" fill="#101A38">{lang === 'ar' ? 'البناة الصغار' : 'Big Builders'}</text>
                <text y="74" fontSize="11.5" fontFamily="var(--font-mono)" fontWeight="600" fill="#54618C">AGES 4–6</text>
              </g>
              <g transform="translate(340,110)">
                <circle r="30" fill="#37C8F5" stroke="#101A38" strokeWidth="5" />
                <text y="9" fontSize="26">🎮</text>
                <text y="-44" fontSize="15" fill="#101A38">Smartivo</text>
                <text y="-26" fontSize="11.5" fontFamily="var(--font-mono)" fontWeight="600" fill="#54618C">AGES 4–8 · ONLINE</text>
              </g>
              <g transform="translate(600,250)">
                <circle r="30" fill="#E5AE4A" stroke="#101A38" strokeWidth="5" />
                <text y="9" fontSize="26">⚙️</text>
                <text y="56" fontSize="15" fill="#101A38">{lang === 'ar' ? 'تحدي المكعبات' : 'Bricks Challenge'}</text>
                <text y="74" fontSize="11.5" fontFamily="var(--font-mono)" fontWeight="600" fill="#54618C">AGES 6–10</text>
              </g>
              <g transform="translate(860,110)">
                <circle r="30" fill="#2764D6" stroke="#101A38" strokeWidth="5" />
                <text y="9" fontSize="26">🤖</text>
                <text y="-44" fontSize="15" fill="#101A38">AlgoPlay · RoboToys</text>
                <text y="-26" fontSize="11.5" fontFamily="var(--font-mono)" fontWeight="600" fill="#54618C">AGES 7–11 · ONLINE</text>
              </g>
              <g transform="translate(1040,200)">
                <circle r="30" fill="#101A38" stroke="#101A38" strokeWidth="5" />
                <text y="9" fontSize="24">💻</text>
                <text y="56" fontSize="15" fill="#101A38">AlgoC</text>
                <text y="74" fontSize="11.5" fontFamily="var(--font-mono)" fontWeight="600" fill="#54618C">AGES 10–15 · ONLINE</text>
              </g>
              {/* side branch: Galileo */}
              <path d="M600 250 C 660 300 720 300 780 292" fill="none" stroke="#C9D6F2" strokeWidth="10" strokeLinecap="round" />
              <g transform="translate(800,290)">
                <circle r="24" fill="#C98A1E" stroke="#101A38" strokeWidth="5" />
                <text y="8" fontSize="20">🔭</text>
                <text y="46" fontSize="14" fill="#101A38">Galileo Technic</text>
                <text y="62" fontSize="11" fontFamily="var(--font-mono)" fontWeight="600" fill="#54618C">AGES 8–12</text>
              </g>
              {/* flag */}
              <g transform="translate(1040,140)">
                <line x1="0" y1="0" x2="0" y2="34" stroke="#101A38" strokeWidth="4" />
                <path d="M0 0 L34 8 L0 16Z" fill="#FFC400" stroke="#101A38" strokeWidth="3" />
              </g>
            </g>
          </svg>
        </div>

        <div className="legend">
          <span><i style={{ background: '#2764D6' }}></i>{d.legendOnline}</span>
          <span><i style={{ background: '#E5AE4A' }}></i>{d.legendInPerson}</span>
          <span><i style={{ background: '#C9D6F2' }}></i>{d.legendPathContinues}</span>
        </div>
      </div>
    </section>
  );
}
