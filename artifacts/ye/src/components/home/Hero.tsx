'use client';

import { useState } from 'react';
import { dict } from '@/lib/i18n';
import { LICENSE_NO } from '@/lib/constants';

export function Hero({ lang }: { lang: 'ar' | 'en' }) {
  const d = dict[lang];
  const [salt, setSalt] = useState(0);
  const [gear, setGear] = useState(0);
  const [sun, setSun] = useState(45);
  const [sequence, setSequence] = useState<string[]>([]);

  return (
    <section className="sec hero v9-hero" id="top" aria-label={lang === 'ar' ? 'الصفحة الرئيسية' : 'Hero'}>
      <div className="flyer" aria-hidden="true">
        <svg className="trail" viewBox="0 0 1400 800" preserveAspectRatio="none"><path d="M -120 190 C 220 100, 480 240, 760 160 S 1200 100, 1500 200" /></svg>
        <div className="kf">
          <svg className="kiteF" viewBox="0 0 340 440"><path d="M170 316 Q 214 356 200 392 Q 190 416 226 414" fill="none" stroke="#E5AE4A" strokeWidth="7" strokeLinecap="round"/><g stroke="#0F1F4B" strokeLinejoin="round"><polygon points="170,36 306,176 170,316 34,176" fill="#FFCA17" strokeWidth="10"/><line x1="170" y1="36" x2="170" y2="316" strokeWidth="6"/><line x1="34" y1="176" x2="306" y2="176" strokeWidth="6"/><polygon points="170,36 306,176 170,176" fill="#FFE066" opacity=".5" stroke="none"/><circle cx="170" cy="176" r="16" fill="#1C54CB" strokeWidth="7"/></g></svg>
          <svg className="capF" viewBox="0 0 260 240"><g stroke="#0F1F4B" strokeLinejoin="round"><polygon points="130,44 246,104 130,164 14,104" fill="#FFCA17" strokeWidth="9"/><path d="M76 142 L76 188 Q130 216 184 188 L184 142" fill="#FFCA17" strokeWidth="9"/><circle cx="130" cy="104" r="12" fill="#1C54CB" strokeWidth="6"/><path d="M130 104 Q 198 118 202 168" fill="none" stroke="#E5AE4A" strokeWidth="6" strokeLinecap="round"/></g></svg>
        </div>
      </div>
      <div className="wrap hero-in">
        <div className="copy">
          <div className="kicker">FUNADEMY · STEM ACADEMY · RIYADH · {lang === 'ar' ? <span className="ar-body">من 4 إلى 18</span> : 'AGES 4–18'}</div>
          {lang === 'ar' ? (
            <h1>لا نعلّم أطفالنا عن الهندسة&nbsp;—<br /><span className="hl">بل نصنع منهم مهندسين.</span></h1>
          ) : (
            <h1>We don&apos;t teach kids about engineering&nbsp;—<br /><span className="hl">we make them engineers.</span></h1>
          )}
          <p className="lede">
            {lang === 'ar'
              ? 'ميكانيكا، روبوتات، وبرمجة حقيقية مبنية على LEGO® للأعمار ٤-١٨ — حصص مباشرة بالعربية، حضورياً في الرياض وأونلاين من منزلك أينما كنت.'
              : 'LEGO®-based mechanics, robotics and real coding for ages 4–18 — live classes in Arabic, in person in Riyadh and online from the comfort of your home.'}
          </p>
          <div className="stem">
            {([['S', 'العلوم', 'Science'], ['T', 'التقنية', 'Technology'], ['E', 'الهندسة', 'Engineering'], ['M', 'الرياضيات', 'Math']] as const).map(([k, ar, en]) => (
              <span className="k" key={k}><b className={k}>{k}</b>{lang === 'ar' ? ar : en}</span>
            ))}
          </div>
          <div className="ctas hcta">
            <a className="btn btn-gold" href="#pricing" data-testid="link-hero-trial">{d.navTrial}</a>
            <a className="btn btn-line" href="#path" data-testid="link-hero-path">{d.navPath}</a>
          </div>
          <div className="trust">
            <span>{lang === 'ar' ? `أكاديمية مرخّصة · ${LICENSE_NO}` : `Licensed academy · ${LICENSE_NO}`}</span>
            <span>{lang === 'ar' ? 'شهادة لكل مستوى' : 'A certificate per level'}</span>
            <span>{lang === 'ar' ? 'مجموعات 8–16' : 'Groups of 8–16'}</span>
            <span>{lang === 'ar' ? 'مدربون معتمدون' : 'Certified instructors'}</span>
          </div>
          <div className="facts">
            <div className="fact"><b>7</b>{lang === 'ar' ? 'برامج معتمدة' : 'official programs'}</div>
            <div className="fact"><b>4–18</b>{lang === 'ar' ? 'سنوات العمر' : 'ages covered'}</div>
            <div className="fact"><b>1<small>st</small></b>{lang === 'ar' ? 'الحصة الأولى مجانية' : 'first class free'}</div>
          </div>
        </div>

        <div className="playwrap" aria-label={lang === 'ar' ? 'مختبر تجارب STEM تفاعلي' : 'Interactive STEM experiment lab'}>
          <div className="playhead"><b>{lang === 'ar' ? 'جرّب STEM الآن — أربع تجارب حيّة' : 'Try STEM now — four live experiments'}</b><span className="live">LIVE DEMO</span></div>
          <div className="play">
            <article className="lab S"><div className="h"><b>{lang === 'ar' ? 'يغرق أم يطفو؟' : 'Sink or float?'}</b><span className="tagp">S · SKYLAB · GLIDE</span></div><div className="stage"><svg viewBox="0 0 200 120" role="img" aria-label={lang === 'ar' ? 'بيضة داخل الماء' : 'Egg in water'}><rect x="55" y="12" width="90" height="100" rx="10" fill="rgba(255,255,255,.08)" stroke="#22DAFF" strokeWidth="2"/><rect x="58" y={40 - salt * .12} width="84" height={69 + salt * .12} rx="8" fill="rgba(34,218,255,.3)"/><ellipse cx="100" cy={92 - salt * .42} rx="14" ry="18" fill="#F7EFDD" stroke="#101A38" strokeWidth="2"/></svg></div><input type="range" min="0" max="100" value={salt} onChange={(event) => setSalt(Number(event.target.value))} aria-label={lang === 'ar' ? 'كمية الملح' : 'Salt amount'}/><div className="out">{salt > 55 ? (lang === 'ar' ? 'تطفو: الكثافة أعلى' : 'FLOAT: higher density') : (lang === 'ar' ? 'تغرق: أضف ملحاً' : 'SINK: add salt')}</div><a className="more" href="#path">SKYLAB GLIDE · {lang === 'ar' ? 'الكثافة' : 'DENSITY'}</a></article>
            <article className="lab T"><div className="h"><b>{lang === 'ar' ? 'برمج الطيارة' : 'Code the kite'}</b><span className="tagp">T · ALGOPLAY</span></div><div className="stage"><svg viewBox="0 0 160 120" role="img" aria-label={lang === 'ar' ? 'شبكة برمجة' : 'Coding grid'}>{Array.from({length:16},(_,index)=><rect key={index} x={12+(index%4)*35} y={8+Math.floor(index/4)*27} width="29" height="21" rx="4" fill={index===7?'#FFCA17':'rgba(255,255,255,.06)'} stroke="rgba(255,255,255,.16)"/>)}<path d="M117 18l8 8-8 8-8-8z" fill="#22DAFF" stroke="#101A38" strokeWidth="3"/></svg></div><div className="seq" aria-live="polite">{sequence.length ? `▸ ${sequence.join(' ')}` : '▸'}</div><div className="codebtns">{['F','R','L'].map((code)=><button type="button" key={code} onClick={()=>setSequence((current)=>[...current,code].slice(-8))}>{code==='F'?'forward ↑':`turn ${code==='R'?'↻':'↺'}`}</button>)}<button type="button" className="run" onClick={()=>setSequence([])}>RUN ▶</button><button type="button" onClick={()=>setSequence([])}>clear</button></div></article>
            <article className="lab E"><div className="h"><b>{lang === 'ar' ? 'نسبة التروس' : 'Gear ratio'}</b><span className="tagp">E · BRICKS CHALLENGE</span></div><div className="stage"><svg viewBox="0 0 220 120" role="img" aria-label={lang === 'ar' ? 'نموذجا تروس' : 'Two gear model'}><g transform="translate(70 60)"><circle r="32" fill="none" stroke="#FFCA17" strokeWidth="12" strokeDasharray="8 5" transform={`rotate(${gear})`}/><circle r="8" fill="#22DAFF"/></g><g transform="translate(157 60)"><circle r="22" fill="none" stroke="#F2CD7E" strokeWidth="10" strokeDasharray="7 4" transform={`rotate(${-gear*1.45})`}/><circle r="6" fill="#22DAFF"/></g></svg></div><input type="range" min="0" max="360" value={gear} onChange={(event)=>setGear(Number(event.target.value))} aria-label={lang === 'ar' ? 'حرّك التروس' : 'Turn the gears'}/><div className="out">{gear}° · {lang === 'ar' ? 'حركة التروس' : 'gear rotation'}</div><a className="more" href="#path">BRICKS CHALLENGE · {lang === 'ar' ? 'التروس' : 'GEARS'}</a></article>
            <article className="lab M"><div className="h"><b>{lang === 'ar' ? 'ساعة الظل' : 'Shadow clock'}</b><span className="tagp">M · SKYLAB · LIFT-OFF</span></div><div className="stage"><svg viewBox="0 0 220 120" role="img" aria-label={lang === 'ar' ? 'تجربة ظل الشمس' : 'Sun shadow experiment'}><line x1="10" y1="100" x2="210" y2="100" stroke="#F2CD7E" strokeWidth="2"/><line x1="120" y1="100" x2={120-Math.cos(sun*Math.PI/180)*60} y2="100" stroke="#0B2263" strokeWidth="8" strokeLinecap="round"/><line x1="120" y1="100" x2="120" y2="50" stroke="#FFCA17" strokeWidth="5" strokeLinecap="round"/><circle cx={180-(sun-45)*1.1} cy="40" r="10" fill="#FFCA17"/><line x1={180-(sun-45)*1.1} y1="40" x2="120" y2="50" stroke="#FFCA17" strokeWidth="1.5" strokeDasharray="4 4"/></svg></div><input type="range" min="15" max="75" value={sun} onChange={(event)=>setSun(Number(event.target.value))} aria-label={lang === 'ar' ? 'زاوية الشمس' : 'Sun angle'}/><div className="out">{sun}° · {lang === 'ar' ? 'طول الظل' : 'shadow angle'}</div><a className="more" href="#path">SKYLAB LIFT-OFF · {lang === 'ar' ? 'ساعة الظل' : 'SHADOW CLOCK'}</a></article>
          </div>
        </div>
      </div>
    </section>
  );
}
