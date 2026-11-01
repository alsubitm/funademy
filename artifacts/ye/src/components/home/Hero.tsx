'use client';

import { useState } from 'react';
import { dict } from '@/lib/i18n';
import { LICENSE_NO } from '@/lib/constants';

/**
 * V3 "curiosity takes flight" hero — adapted from the FunAdemy V3 reference:
 * cream paper, tilted photo on a gold backplate, blue seal, "Aha!" sticker,
 * code bubble, mini-invention card and hand-drawn squiggle. The four live
 * STEM experiments stay inside the same section, beneath the illustration.
 */
export function Hero({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];
  const ar = lang === 'ar';
  const [salt, setSalt] = useState(0);
  const [gear, setGear] = useState(0);
  const [sun, setSun] = useState(45);
  const [sequence, setSequence] = useState<string[]>([]);

  const strip = ar
    ? ['ابنِ شيئاً', 'اسأل أسئلة كبيرة', 'اكتشف بفرح', 'جرّب. عدّل. أعِد.']
    : ['BUILD SOMETHING', 'ASK BIG QUESTIONS', 'MAKE HAPPY DISCOVERIES', 'TRY. TINKER. REPEAT.'];

  return (
    <>
      <section className="sec hero v3-hero" id="top" aria-label={ar ? 'الصفحة الرئيسية' : 'Hero'}>
        <div className="v3-hero-grid">
          <div className="v3-hero-copy">
            <p className="v3-eyebrow">
              <span className="v3-star" aria-hidden="true">✳</span>
              <span>FUNADEMY · STEM ACADEMY · RIYADH · {ar ? <span className="ar-body">من 4 إلى 18</span> : 'AGES 4–18'}</span>
            </p>
            {ar ? (
              <h1>لا نعلّم أطفالنا عن الهندسة&nbsp;—<br /><span className="v3-highlight">بل نصنع منهم مهندسين.</span><span className="v3-spark" aria-hidden="true">✦</span></h1>
            ) : (
              <h1>We don&apos;t teach kids about engineering&nbsp;—<br /><span className="v3-highlight">we make them engineers.</span><span className="v3-spark" aria-hidden="true">✦</span></h1>
            )}
            <p className="v3-lede">
              {ar
                ? 'ميكانيكا، روبوتات، وبرمجة حقيقية مبنية على LEGO® للأعمار ٤-١٨ — حصص مباشرة بالعربية، حضورياً في الرياض.'
                : 'LEGO®-based mechanics, robotics and real coding for ages 4–18 — live classes in Arabic, in person in Riyadh.'}
            </p>
            <div className="v3-stem">
              {([['S', 'العلوم', 'Science'], ['T', 'التقنية', 'Technology'], ['E', 'الهندسة', 'Engineering'], ['M', 'الرياضيات', 'Math']] as const).map(([k, arL, enL]) => (
                <span className="k" key={k}><b className={k}>{k}</b>{ar ? arL : enL}</span>
              ))}
            </div>
            <div className="v3-actions">
              <a className="v3-button v3-button-blue" href="#pricing" data-testid="link-hero-trial">
                <span>{d.navTrial}</span><span aria-hidden="true">↗</span>
              </a>
              <a className="v3-text-link" href="#path" data-testid="link-hero-path">
                <span className="v3-play" aria-hidden="true">▷</span><span>{d.navPath}</span>
              </a>
            </div>
            <div className="v3-note"><span className="v3-note-line" aria-hidden="true" />{ar ? 'لأطفال فضوليين. ولأكبر داعميهم.' : 'For curious kids. And their biggest supporters.'}</div>
            <ul className="v3-trust">
              <li>{ar ? `أكاديمية مرخّصة · ${LICENSE_NO}` : `Licensed academy · ${LICENSE_NO}`}</li>
              <li>{ar ? 'شهادة لكل مستوى' : 'A certificate per level'}</li>
              <li>{ar ? 'مجموعات 8–16' : 'Groups of 8–16'}</li>
              <li>{ar ? 'مدربون معتمدون' : 'Certified instructors'}</li>
            </ul>
            <div className="v3-facts">
              <div><b>7</b>{ar ? 'برامج معتمدة' : 'official programs'}</div>
              <div><b dir="ltr">4–18</b>{ar ? 'سنوات العمر' : 'ages covered'}</div>
              <div><b dir="ltr">1<small>st</small></b>{ar ? 'الحصة الأولى مجانية' : 'first class free'}</div>
            </div>
          </div>

          <div className="v3-hero-visual">
            <div className="v3-code-bubble" aria-hidden="true">{'{ curiosity: ∞ }'}</div>
            <svg className="v3-gear" viewBox="0 0 100 100" aria-hidden="true"><path d="M43 4h14l2 12 9 4 10-7 10 10-7 10 4 9 12 2v14l-12 2-4 9 7 10-10 10-10-7-9 4-2 12H43l-2-12-9-4-10 7-10-10 7-10-4-9-12-2V43l12-2 4-9-7-10 10-10 10 7 9-4z" fill="#ffca17" stroke="#101a38" strokeWidth="3" strokeLinejoin="round" /><circle cx="50" cy="50" r="17" fill="#faf7ed" stroke="#101a38" strokeWidth="3" /></svg>
            <div className="v3-mini" aria-hidden="true">
              <img src="/v3/mini-invention.webp" width={200} height={140} alt="" loading="lazy" />
              <span>{ar ? 'أفكار تتحرّك.' : 'IDEAS, IN MOTION.'}</span>
            </div>
            <svg className="v3-squiggle" viewBox="0 0 116 51" aria-hidden="true"><path d="M3 30c12-24 26-24 30 0s20 24 26 0 22-26 28 0 18 18 26-6" fill="none" stroke="#1c54cb" strokeWidth="4" strokeLinecap="round" /></svg>
            <div className="v3-backplate" aria-hidden="true" />
            <figure className="v3-photo">
              <img src="/v3/hero-classroom.webp" width={1400} height={933} fetchPriority="high" alt={ar ? 'طفل يستكشف الهندسة بقطع البناء' : 'A young learner exploring engineering with construction pieces'} />
              <figcaption><span className="v3-idx">01 /</span><span>{ar ? 'أيادٍ صغيرة. إمكانيات كبيرة.' : 'SMALL HANDS. BIG POSSIBILITIES.'}</span><span aria-hidden="true">↗</span></figcaption>
            </figure>
            <div className="v3-seal" aria-hidden="true"><span>{ar ? 'صُنع لـ' : 'MADE FOR'}</span><b>✳</b><span>{ar ? 'العقول الفضولية' : 'CURIOUS MINDS'}</span></div>
            <div className="v3-aha" aria-hidden="true"><span>{ar ? 'وجدتها!' : 'Aha!'}</span><svg viewBox="0 0 74 45"><path d="M4 6c18 2 40 10 54 30M58 36l-12-2M58 36l2-12" /></svg></div>
            <div className="v3-tag"><span className="v3-tag-dot" aria-hidden="true" />{ar ? 'تعلّم عملي بالكامل' : '100% hands-on wonder'}</div>
          </div>
        </div>

        <div className="v3-lab" id="stem-lab" aria-label={ar ? 'مختبر تجارب STEM تفاعلي' : 'Interactive STEM experiment lab'}>
          <div className="v3-lab-head">
            <p className="v3-eyebrow"><span className="v3-live" aria-hidden="true" />LIVE DEMO</p>
            <h2>{ar ? 'جرّب STEM الآن — أربع تجارب حيّة' : 'Try STEM now — four live experiments'}</h2>
          </div>
          <div className="v3-lab-grid">
            <article className="v3-exp S">
              <div className="h"><b>{ar ? 'يغرق أم يطفو؟' : 'Sink or float?'}</b><span className="tagp">S · SKYLAB · GLIDE</span></div>
              <div className="stage"><svg viewBox="0 0 200 120" role="img" aria-label={ar ? 'بيضة داخل الماء' : 'Egg in water'}><rect x="55" y="12" width="90" height="100" rx="10" fill="#fffefa" stroke="#101a38" strokeWidth="2.5" /><rect x="58" y={40 - salt * .12} width="84" height={69 + salt * .12} rx="8" fill="#bfe9f5" /><ellipse cx="100" cy={92 - salt * .42} rx="14" ry="18" fill="#ffca17" stroke="#101a38" strokeWidth="2.5" /></svg></div>
              <input type="range" min="0" max="100" value={salt} onChange={(event) => setSalt(Number(event.target.value))} aria-label={ar ? 'كمية الملح' : 'Salt amount'} data-testid="input-lab-salt" />
              <div className="out" aria-live="polite">{salt > 55 ? (ar ? 'تطفو: الكثافة أعلى' : 'FLOAT: higher density') : (ar ? 'تغرق: أضف ملحاً' : 'SINK: add salt')}</div>
              <a className="more" href="#path">SKYLAB GLIDE · {ar ? 'الكثافة' : 'DENSITY'}</a>
            </article>
            <article className="v3-exp T">
              <div className="h"><b>{ar ? 'برمج الطيارة' : 'Code the kite'}</b><span className="tagp">T · ALGOPLAY</span></div>
              <div className="stage"><svg viewBox="0 0 160 120" role="img" aria-label={ar ? 'شبكة برمجة' : 'Coding grid'}>{Array.from({ length: 16 }, (_, index) => <rect key={index} x={12 + (index % 4) * 35} y={8 + Math.floor(index / 4) * 27} width="29" height="21" rx="5" fill={index === 7 ? '#ffca17' : '#fffefa'} stroke="#101a38" strokeOpacity={index === 7 ? 1 : .25} />)}<path d="M117 18l8 8-8 8-8-8z" fill="#1c54cb" stroke="#101a38" strokeWidth="2" /></svg></div>
              <div className="seq" aria-live="polite">{sequence.length ? `▸ ${sequence.join(' ')}` : '▸'}</div>
              <div className="codebtns">
                {['F', 'R', 'L'].map((code) => <button type="button" key={code} data-testid={`button-lab-code-${code}`} onClick={() => setSequence((current) => [...current, code].slice(-8))}>{code === 'F' ? 'forward ↑' : `turn ${code === 'R' ? '↻' : '↺'}`}</button>)}
                <button type="button" className="run" data-testid="button-lab-run" onClick={() => setSequence([])}>RUN ▶</button>
                <button type="button" data-testid="button-lab-clear" onClick={() => setSequence([])}>clear</button>
              </div>
            </article>
            <article className="v3-exp E">
              <div className="h"><b>{ar ? 'نسبة التروس' : 'Gear ratio'}</b><span className="tagp">E · BRICKS CHALLENGE</span></div>
              <div className="stage"><svg viewBox="0 0 220 120" role="img" aria-label={ar ? 'نموذجا تروس' : 'Two gear model'}><g transform="translate(70 60)"><circle r="32" fill="none" stroke="#1c54cb" strokeWidth="12" strokeDasharray="8 5" transform={`rotate(${gear})`} /><circle r="8" fill="#101a38" /></g><g transform="translate(157 60)"><circle r="22" fill="none" stroke="#e5ae4a" strokeWidth="10" strokeDasharray="7 4" transform={`rotate(${-gear * 1.45})`} /><circle r="6" fill="#101a38" /></g></svg></div>
              <input type="range" min="0" max="360" value={gear} onChange={(event) => setGear(Number(event.target.value))} aria-label={ar ? 'حرّك التروس' : 'Turn the gears'} data-testid="input-lab-gear" />
              <div className="out">{gear}° · {ar ? 'حركة التروس' : 'gear rotation'}</div>
              <a className="more" href="#path">BRICKS CHALLENGE · {ar ? 'التروس' : 'GEARS'}</a>
            </article>
            <article className="v3-exp M">
              <div className="h"><b>{ar ? 'ساعة الظل' : 'Shadow clock'}</b><span className="tagp">M · SKYLAB · LIFT-OFF</span></div>
              <div className="stage"><svg viewBox="0 0 220 120" role="img" aria-label={ar ? 'تجربة ظل الشمس' : 'Sun shadow experiment'}><line x1="10" y1="100" x2="210" y2="100" stroke="#101a38" strokeWidth="2" /><line x1="120" y1="100" x2={120 - Math.cos(sun * Math.PI / 180) * 60} y2="100" stroke="#11388e" strokeWidth="8" strokeLinecap="round" /><line x1="120" y1="100" x2="120" y2="50" stroke="#101a38" strokeWidth="5" strokeLinecap="round" /><circle cx={180 - (sun - 45) * 1.1} cy="40" r="10" fill="#ffca17" stroke="#101a38" strokeWidth="2" /><line x1={180 - (sun - 45) * 1.1} y1="40" x2="120" y2="50" stroke="#e5ae4a" strokeWidth="1.5" strokeDasharray="4 4" /></svg></div>
              <input type="range" min="15" max="75" value={sun} onChange={(event) => setSun(Number(event.target.value))} aria-label={ar ? 'زاوية الشمس' : 'Sun angle'} data-testid="input-lab-sun" />
              <div className="out">{sun}° · {ar ? 'طول الظل' : 'shadow angle'}</div>
              <a className="more" href="#path">SKYLAB LIFT-OFF · {ar ? 'ساعة الظل' : 'SHADOW CLOCK'}</a>
            </article>
          </div>
        </div>
      </section>
      <div className="v3-strip" aria-hidden="true">
        <div className="v3-strip-track">
          {[...strip, ...strip].map((item, index) => <span key={index}>{item}<b>✳</b></span>)}
        </div>
      </div>
    </>
  );
}
