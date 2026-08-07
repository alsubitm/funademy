import { dict } from '@/lib/i18n';
import { LICENSE_NO } from '@/lib/constants';

export function Hero({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];

  return (
    <header className="hero">
      <div className="bpgrid"></div>
      <div className="wrap hero-in">
        <div>
          <div className="lic">LICENSE № {LICENSE_NO} · e² YOUNG ENGINEERS · OFFICIAL</div>
          {lang === 'ar' ? (
            <>
              <h1 className="ar" style={{ fontSize: 'clamp(36px,5.2vw,60px)', lineHeight: 1.06, color: '#fff', marginTop: 0 }}>
                لا نعلّم الأطفال عن الهندسة.<br />
                <span className="y">نحن نصنعهم</span> <span className="u">مهندسين.</span>
              </h1>
              <p className="lead" style={{ marginTop: '14px' }}>
                ميكانيكا، روبوتات، وبرمجة حقيقية مبنية على LEGO® للأعمار ٤-١٨ — حصص مباشرة بالعربية، أونلاين من المنزل أو حضوري في الرياض.
              </p>
              <div className="ar" style={{ marginTop: '14px', fontSize: '20px', color: '#9FC0FF', fontFamily: 'var(--font-display)', fontWeight: 700 }}>
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
                LEGO®-based mechanics, robotics and real coding for ages 4–18 — live classes in Arabic, online from home or in-person across Riyadh.
              </p>
              <div className="ar">نصنع مهندسين صغار — أونلاين وحضوري 🤖</div>
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
            <span>{lang === 'ar' ? 'مباشر، غير مسجل' : 'Live, never recorded'}</span>
            <span>{lang === 'ar' ? 'مدربون معتمدون' : 'Certified instructors'}</span>
            <span>{lang === 'ar' ? 'الأعمار ٤-١٨' : 'Ages 4–18'}</span>
          </div>
        </div>

        {/* ANNOTATED ROBOT SPEC SHEET */}
        <div className="spec" dir="ltr">
          <div className="corner c1"></div>
          <div className="corner c2"></div>
          <div className="corner c3"></div>
          <div className="corner c4"></div>
          <div className="head">
            <span>PROJECT: YOUNG ENGINEER v1.0</span>
            <span>SCALE 1:1 · SHEET 01</span>
          </div>
          <svg viewBox="0 0 540 420">
            <g stroke="#37C8F5" strokeWidth="1.6" strokeDasharray="5 4" fill="none">
              <path d="M262 52 L360 30 L470 30" />
              <path d="M198 132 L120 96 L38 96" />
              <path d="M348 208 L432 190 L510 190" />
              <path d="M180 262 L104 300 L30 300" />
              <path d="M300 352 L392 372 L486 372" />
            </g>
            <g fontFamily="var(--font-mono)" fontSize="10.5" fill="#7FD7FF" letterSpacing=".08em">
              <text x="366" y="24">CURIOSITY ANTENNA — ALWAYS ON</text>
              <text x="36" y="88">IMAGINATION CORE: ∞</text>
              <text x="436" y="182">PROBLEM-SOLVER ARM v2</text>
              <text x="30" y="292">BUILDER HANDS — CALIBRATED</text>
              <text x="390" y="364">FUTURE-READY LEGS 🚀</text>
            </g>
            <g stroke="#7FA5F0" strokeWidth="1.4" fill="#7FA5F0" fontFamily="var(--font-mono)" fontSize="10">
              <line x1="150" y1="405" x2="392" y2="405" />
              <path d="M150 405 l8 -4 v8 z" />
              <path d="M392 405 l-8 -4 v8 z" />
              <text x="238" y="398" fill="#7FA5F0">100% FUN GUARANTEED</text>
            </g>
            <g stroke="#081D4D" strokeWidth="6" strokeLinejoin="round">
              <line x1="262" y1="78" x2="262" y2="54" stroke="#37C8F5" strokeWidth="5" />
              <circle cx="262" cy="46" r="10" fill="#C98A1E" />
              <rect x="198" y="78" width="128" height="96" rx="20" fill="#FFC400" />
              <circle cx="236" cy="120" r="15" fill="#fff" />
              <circle cx="288" cy="120" r="15" fill="#fff" />
              <circle cx="239" cy="122" r="7" fill="#101A38" stroke="none" />
              <circle cx="291" cy="122" r="7" fill="#101A38" stroke="none" />
              <path d="M240 150 Q262 164 284 150" fill="none" strokeLinecap="round" />
              <rect x="180" y="108" width="18" height="34" rx="7" fill="#E5AE4A" />
              <rect x="326" y="108" width="18" height="34" rx="7" fill="#E5AE4A" />
              <circle cx="232" cy="188" r="12" fill="#2764D6" />
              <circle cx="292" cy="188" r="12" fill="#2764D6" />
              <rect x="190" y="188" width="144" height="108" rx="18" fill="#2764D6" />
              <rect x="218" y="214" width="88" height="50" rx="10" fill="#fff" />
              <g stroke="none" fontFamily="var(--font-mono)" fontWeight="600">
                <text x="234" y="236" fontSize="12" fill="#2764D6">&lt;build/&gt;</text>
                <text x="234" y="254" fontSize="11" fill="#E5AE4A">skills++;</text>
              </g>
              <path d="M190 208 Q144 218 140 258" fill="none" strokeLinecap="round" />
              <circle cx="138" cy="266" r="14" fill="#C98A1E" />
              <path d="M334 208 Q382 200 396 168" fill="none" strokeLinecap="round" />
              <circle cx="402" cy="160" r="14" fill="#C98A1E" />
              <path d="M420 122 l6 13 13 6 -13 6 -6 13 -6 -13 -13 -6 13 -6z" fill="#FFC400" strokeWidth="4" />
              <rect x="214" y="296" width="36" height="50" rx="10" fill="#E5AE4A" />
              <rect x="274" y="296" width="36" height="50" rx="10" fill="#E5AE4A" />
              <rect x="204" y="340" width="56" height="20" rx="9" fill="#101A38" />
              <rect x="264" y="340" width="56" height="20" rx="9" fill="#101A38" />
            </g>
          </svg>
          <svg className="stamp" viewBox="0 0 120 120">
            <defs>
              <path id="circ" d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" />
            </defs>
            <circle cx="60" cy="60" r="56" fill="#FFC400" />
            <circle cx="60" cy="60" r="56" fill="none" stroke="#101A38" strokeWidth="3" />
            <circle cx="60" cy="60" r="34" fill="none" stroke="#101A38" strokeWidth="2" strokeDasharray="4 3" />
            <text fontFamily="var(--font-mono)" fontSize="10.5" fontWeight="600" fill="#101A38" letterSpacing="2">
              <textPath href="#circ">OFFICIAL LICENSEE • RIYADH NORTH • e² YE • </textPath>
            </text>
            <text x="60" y="66" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="800" fontSize="22" fill="#101A38">✓</text>
          </svg>
        </div>
      </div>
    </header>
  );
}
