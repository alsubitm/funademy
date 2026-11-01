'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { EMAIL, PHONE_DISPLAY, WHATSAPP_NUMBER } from '@/lib/constants';
import type { CopyKey, Program } from './data';
import { prefix, rich, tr, type Lang } from './shared';
import { IdeaMachine } from './IdeaMachine';
import { Programs } from './Programs';
import { CodingLab } from './CodingLab';
import { KiteCapMark } from '@/components/brand/KiteCapMark';
import { SocialLinks } from '@/components/SocialLinks';
import './fa3.css';

/**
 * FunAdemy V3 homepage — faithful React port of the attached
 * FunAdemy-V3-Arabic reference (DOM composition, copy, styles, interactions).
 */
export function FunHome({ lang }: { lang: Lang }) {
  const t = (k: CopyKey) => tr(lang, k);
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [paused, setPaused] = useState(false);
  const [enqType, setEnqType] = useState('parent');
  const [interest, setInterest] = useState('choosing');
  const [note, setNote] = useState('');
  const [drafted, setDrafted] = useState(false);
  const [year, setYear] = useState(2026);
  const [landed, setLanded] = useState(false);
  const home = prefix(lang, '/');

  useEffect(() => {
    setYear(new Date().getFullYear());
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduce.matches) setPaused(true);
    const root = rootRef.current;
    if (!root || !('IntersectionObserver' in window) || reduce.matches) return;
    root.classList.add('js-motion');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); } });
    }, { threshold: 0.08 });
    root.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
    return () => { observer.disconnect(); root.classList.remove('js-motion'); };
  }, []);

  const onEnquire = (p: Program) => {
    setInterest(p.category === 'building' ? 'building' : 'coding');
    setNote(lang === 'en' ? `I’d like to know more about ${p.name}.` : `أود معرفة المزيد عن برنامج ${p.name}.`);
  };

  const typeLabels: Record<string, CopyKey> = { parent: 'parentOption', school: 'schoolOption', other: 'otherOption' };
  const interestLabels: Record<string, CopyKey> = { choosing: 'chooseOption', building: 'buildingOption', coding: 'codingOption', partnership: 'partnerOption' };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const type = t(typeLabels[enqType]);
    const intr = t(interestLabels[interest]);
    const body = note.trim();
    const subject = lang === 'en' ? `FunAdemy enquiry — ${intr}` : `استفسار FunAdemy — ${intr}`;
    const text = lang === 'en'
      ? `Hello FunAdemy,\n\nI’m getting in touch as a: ${type}\nI’m interested in: ${intr}\n\n${body}\n\nThank you!`
      : `مرحبًا FunAdemy،\n\nأتواصل بصفتي: ${type}\nأهتم بمعرفة المزيد عن: ${intr}\n\n${body}\n\nشكرًا لكم!`;
    const link = document.createElement('a');
    link.href = `mailto:${EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;
    link.click();
    setDrafted(true);
  };

  const navLinks = (
    <>
      <a href="#our-way" onClick={() => setMenuOpen(false)}>{t('navWay')}</a>
      <a href="#programs" onClick={() => setMenuOpen(false)}>{t('navPrograms')}</a>
      <a href="#schools" onClick={() => setMenuOpen(false)}>{t('navSchools')}</a>
    </>
  );

  const brand = (
    <Link className="brand" href={home} aria-label="FunAdemy home">
      <KiteCapMark size={44} className="brand-kite" />
      <span>Fun<span>Ademy</span><small>{t('brandTag')}</small></span>
    </Link>
  );

  const feature = lang === 'ar'
    ? [['/book', 'احجز حصة تجريبية'], ['/enroll', 'التسجيل'], ['/programs', 'البرامج'], ['/portal', 'بوابة الأهالي'], ['/learn', 'مكتبة الأنشطة'], ['/blog', 'المدونة'], ['/account', 'حسابي'], ['/contact', 'تواصل معنا']]
    : [['/book', 'Book a trial'], ['/enroll', 'Enroll'], ['/programs', 'Programs'], ['/portal', 'Parent portal'], ['/learn', 'Resource library'], ['/blog', 'Blog'], ['/account', 'My account'], ['/contact', 'Contact']];

  return (
    <div className={`fa3${paused ? ' motion-paused' : ''}`} ref={rootRef}>
      <a className="skip-link" href="#main">{t('skip')}</a>
      <div className="club-banner"><span aria-hidden="true">✳</span><p>{t('clubBanner')}</p><span aria-hidden="true">✳</span></div>
      <header className="site-header">
        {brand}
        <nav className="desktop-nav" aria-label="Main navigation">{navLinks}</nav>
        <div className="nav-actions">
          <Link className="language-button" href={lang === 'ar' ? '/en' : '/'} lang={lang === 'ar' ? 'en' : 'ar'} aria-label={lang === 'en' ? 'Switch to Arabic' : 'Switch to English'} data-testid="link-language">
            {lang === 'en' ? 'العربية' : 'English'} <span aria-hidden="true">◎</span>
          </Link>
          <a className="button button-small button-navy header-cta" href="#contact"><span>{t('letsTalk')}</span><span aria-hidden="true">↗</span></a>
          <button className="menu-button" type="button" aria-expanded={menuOpen} aria-controls="mobile-nav" aria-label={t(menuOpen ? 'closeMenu' : 'openMenu')} onClick={() => setMenuOpen((o) => !o)} data-testid="button-menu"><span /><span /></button>
        </div>
      </header>
      <nav className="mobile-nav" id="mobile-nav" aria-label="Mobile navigation" hidden={!menuOpen}>
        {navLinks}
        <a href="#contact" onClick={() => setMenuOpen(false)}>{t('letsTalk')}</a>
        <div className="mobile-extra">
          {feature.slice(0, 6).map(([path, label]) => <Link key={path} href={prefix(lang, path)}>{label}</Link>)}
        </div>
      </nav>

      <main id="main">
        <section className="hero section-wrap">
          <div className="hero-copy">
            <p className="eyebrow"><span className="tiny-star" aria-hidden="true">✳</span> <span>{t('heroEyebrow')}</span></p>
            <h1><span>{t('heroTitle1')}</span><br /><span className="highlight">{t('heroTitle2')}</span><span className="title-spark" aria-hidden="true">✦</span></h1>
            <p className="hero-description">{t('heroDescription')}</p>
            <div className="hero-actions">
              <a className="button button-blue" href="#programs" data-testid="link-hero-explore"><span>{t('explore')}</span><span aria-hidden="true">↗</span></a>
              <a className="text-link" href="#idea-machine" data-testid="link-hero-spark"><span className="play-icon" aria-hidden="true">▷</span><span>{t('trySpark')}</span></a>
            </div>
            <div className="hero-note"><span className="note-line" aria-hidden="true" /><span>{t('heroNote')}</span></div>
          </div>
          <div className="hero-visual">
            <svg className="orbit-trail" viewBox="0 0 600 600" aria-hidden="true"><ellipse cx="300" cy="300" rx="283" ry="215" transform="rotate(-35 300 300)" /><path d="M60 390q70 170 290 125" /></svg>
            <div className="code-bubble" aria-hidden="true">{'{ curiosity: ∞ }'}</div>
            <svg className="hero-gear" viewBox="0 0 100 100" aria-hidden="true"><polygon points="50.00,5.00 54.41,5.22 57.02,14.69 60.45,15.55 67.22,8.43 71.21,10.31 70.00,20.07 72.84,22.17 81.82,18.18 84.79,21.45 79.93,30.00 81.75,33.03 91.57,32.78 93.06,36.94 85.31,42.98 85.83,46.47 95.00,50.00 94.78,54.41 85.31,57.02 84.45,60.45 91.57,67.22 89.69,71.21 79.93,70.00 77.83,72.84 81.82,81.82 78.55,84.79 70.00,79.93 66.97,81.75 67.22,91.57 63.06,93.06 57.02,85.31 53.53,85.83 50.00,95.00 45.59,94.78 42.98,85.31 39.55,84.45 32.78,91.57 28.79,89.69 30.00,79.93 27.16,77.83 18.18,81.82 15.21,78.55 20.07,70.00 18.25,66.97 8.43,67.22 6.94,63.06 14.69,57.02 14.17,53.53 5.00,50.00 5.22,45.59 14.69,42.98 15.55,39.55 8.43,32.78 10.31,28.79 20.07,30.00 22.17,27.16 18.18,18.18 21.45,15.21 30.00,20.07 33.03,18.25 32.78,8.43 36.94,6.94 42.98,14.69 46.47,14.17" /><circle cx="50" cy="50" r="17" fill="#faf7ed" /></svg>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <div className="mini-invention"><img src="/v3/mini-invention.webp" width={200} height={140} alt="" /><span>{t('miniInvention')}</span></div>
            <svg className="hero-squiggle" viewBox="0 0 116 51" aria-hidden="true"><path d="M4 22q12-27 24 0t24 0t24 0t24 0m-4-10 7 17 9-16" /></svg>
            <div className="photo-backplate" aria-hidden="true" />
            <figure className="hero-photo">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/v3/traditional-saudi-hero.webp" fetchPriority="high" width={1024} height={1024} alt={t('heroAlt')} />
              <figcaption><span className="photo-index">01 /</span> <span>{t('photoCaption')}</span><span aria-hidden="true">↗</span></figcaption>
            </figure>
            <div className="curiosity-seal" aria-hidden="true"><span>{t('sealTop')}</span><b>✳</b><span>{t('sealBottom')}</span></div>
            <div className="aha-sticker" aria-hidden="true"><span>{t('aha')}</span><svg viewBox="0 0 80 50"><path d="M7 37 Q29 4 61 20 M50 9 L65 20 L51 32" /></svg></div>
            <div className="floating-tag"><span className="tag-dot" aria-hidden="true" /><span>{t('handsOn')}</span></div>
          </div>
          <div className="hero-scroll"><span aria-hidden="true">↓</span><span>{t('scrollHint')}</span></div>
        </section>

        <div className="discovery-strip" aria-hidden="true">
          <div className="discovery-track">
            {[0, 1].flatMap((r) => (['strip1', 'strip2', 'strip3', 'strip4'] as CopyKey[]).flatMap((k) => [<span key={`${r}${k}`}>{t(k)}</span>, <b key={`${r}${k}b`}>✳</b>]))}
          </div>
        </div>

        <section className="our-way section-wrap" id="our-way">
          <div className="way-intro reveal"><p className="eyebrow">{t('wayEyebrow')}</p><h2><span>{t('wayTitle1')}</span><br /><span className="blue-text">{t('wayTitle2')}</span></h2><p>{t('wayDescription')}</p><div className="pencil-note"><span aria-hidden="true">↳</span><span>{t('wayNote')}</span></div>
            <button type="button" className="kitecap" aria-pressed={landed} onClick={() => setLanded((v) => !v)} data-testid="button-kitecap"
              aria-label={lang === 'en' ? (landed ? 'Graduation cap: tap to fly the kite again' : 'Kite: tap to land it as a graduation cap') : (landed ? 'قبعة التخرج: اضغط لتطير الطائرة الورقية من جديد' : 'طائرة ورقية: اضغط لتهبط وتصبح قبعة تخرج')}>
              <span className="kitecap-stage"><span className="kitecap-orbit" aria-hidden="true" /><KiteCapMark size={120} landed={landed} className="kitecap-mark" /></span>
              <span className="kitecap-copy" aria-hidden="true"><b>{lang === 'en' ? (landed ? 'Curiosity, graduated.' : 'Curiosity takes flight.') : (landed ? 'الفضول يتخرّج.' : 'الفضول يحلّق.')}</b><small>{lang === 'en' ? 'Tap the kite' : 'اضغط على الطائرة'} ↻</small></span>
            </button></div>
          <div className="way-steps">
            {([['01', 'step1Title', 'step1Body', '✦', ''], ['02', 'step2Title', 'step2Body', '▦', ' blocks-icon'], ['03', 'step3Title', 'step3Body', '↗', '']] as const).map(([n, h, b, icon, cls]) => (
              <article className="way-step reveal" key={n}><div className="step-number">{n}</div><div><h3>{t(h)}</h3><p>{t(b)}</p></div><span className={`step-icon${cls}`} aria-hidden="true">{icon}</span></article>
            ))}
          </div>
        </section>

        <IdeaMachine lang={lang} />
        <Programs lang={lang} onEnquire={onEnquire} />

        <section className="service-section section-wrap" aria-labelledby="service-title">
          <div className="service-heading"><div><p className="eyebrow">{t('serviceEyebrow')}</p><h2 id="service-title">{t('serviceTitle')}</h2></div><p>{t('serviceNote')}</p></div>
          <div className="service-links">
            {([['01', '/book', 'serviceBook', 'serviceBookDesc'], ['02', '/portal', 'servicePortal', 'servicePortalDesc'], ['03', '/learn', 'serviceLearn', 'serviceLearnDesc']] as const).map(([n, path, h, d]) => (
              <Link key={n} href={prefix(lang, path)} data-testid={`link-service-${path.slice(1)}`}><span className="service-number" aria-hidden="true">{n}</span><div><h3>{t(h)}</h3><p>{t(d)}</p></div><span className="service-arrow" aria-hidden="true">↗</span></Link>
            ))}
          </div>
        </section>

        <section className="play-section" id="play">
          <div className="section-wrap play-layout">
            <div className="play-copy reveal"><p className="eyebrow"><span aria-hidden="true">✳</span> <span>{t('playEyebrow')}</span></p><h2><span>{t('playTitle1')}</span><br /><span>{t('playTitle2')}</span></h2><p>{t('playBody')}</p><div className="play-lesson"><span aria-hidden="true">↳</span><div><b>{t('lessonTitle')}</b><p>{t('lessonBody')}</p></div></div><p className="demo-note">{t('demoNote')}</p></div>
            <CodingLab lang={lang} motionPaused={paused} />
          </div>
        </section>

        <section className="schools section-wrap" id="schools">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="school-photo reveal"><img src="/v3/traditional-saudi-school.webp" alt={t('schoolAlt')} loading="lazy" width={1024} height={1024} /><div className="school-label"><span aria-hidden="true">✳</span><span>{t('schoolLabel')}</span></div></div>
          <div className="school-copy reveal"><p className="eyebrow">{t('schoolsEyebrow')}</p><h2><span>{t('schoolTitle1')}</span><br /><span className="highlight">{t('schoolTitle2')}</span></h2><p>{t('schoolBody')}</p>
            <ul className="school-points">{(['schoolPoint1', 'schoolPoint2', 'schoolPoint3'] as const).map((k) => <li key={k}><span aria-hidden="true">↗</span><span>{t(k)}</span></li>)}</ul>
            <a className="button button-navy" href="#contact" data-testid="link-school-enquiry" onClick={() => { setEnqType('school'); setInterest('partnership'); }}><span>{t('schoolCta')}</span><span aria-hidden="true">↗</span></a>
          </div>
        </section>

        <section className="faq section-wrap">
          <div className="faq-heading"><p className="eyebrow">{t('faqEyebrow')}</p><h2>{t('faqTitle')}</h2></div>
          <div className="faq-list">
            {([1, 2, 3, 4] as const).map((n) => (
              <details key={n}><summary><span>{t(`faqQ${n}` as CopyKey)}</span><span aria-hidden="true">+</span></summary><p>{t(`faqA${n}` as CopyKey)}</p></details>
            ))}
          </div>
        </section>

        <section className="contact-section" id="contact">
          <div className="section-wrap contact-layout">
            <div className="contact-copy">
              <p className="eyebrow">{t('contactEyebrow')}</p>
              <h2><span>{t('contactTitle1')}</span><br /><span>{t('contactTitle2')}</span><span aria-hidden="true">↗</span></h2>
              <p>{t('contactBody')}</p>
              <a className="contact-email" href={`mailto:${EMAIL}`} dir="ltr">{EMAIL}</a>
              <div className="contact-links"><a href={`tel:+${WHATSAPP_NUMBER}`} dir="ltr">{PHONE_DISPLAY}</a><span>·</span><a href={`https://wa.me/${WHATSAPP_NUMBER}`} target="_blank" rel="noopener">{t('whatsapp')}</a></div>
            </div>
            <form className="enquiry-form" onSubmit={submit}>
              <h3>{t('formTitle')}</h3>
              <div className="form-field"><label htmlFor="enquiry-type">{t('formWho')}</label>
                <select id="enquiry-type" value={enqType} onChange={(e) => setEnqType(e.target.value)} data-testid="select-enquiry-type">
                  {Object.entries(typeLabels).map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
                </select></div>
              <div className="form-field"><label htmlFor="interest">{t('formInterest')}</label>
                <select id="interest" value={interest} onChange={(e) => setInterest(e.target.value)} data-testid="select-interest">
                  {Object.entries(interestLabels).map(([v, k]) => <option key={v} value={v}>{t(k)}</option>)}
                </select></div>
              <div className="form-field"><label htmlFor="enquiry-note">{rich(t('formNote'))}</label>
                <textarea id="enquiry-note" rows={3} maxLength={1000} placeholder={t('notePlaceholder')} value={note} onChange={(e) => setNote(e.target.value)} data-testid="input-enquiry-note" /></div>
              <button type="submit" className="button button-navy" data-testid="button-enquiry-submit"><span>{t('formSubmit')}</span><span aria-hidden="true">↗</span></button>
              <p className="form-explainer">{t('formExplainer')}</p>
              <p className="form-status" role="status" hidden={!drafted}>{drafted ? t('formSuccess') : ''}</p>
            </form>
          </div>
        </section>
      </main>

      <footer className="site-footer section-wrap">
        <div className="footer-big" aria-hidden="true"><div>Fun<span>Ademy</span></div><b>✳</b></div>
        <nav className="footer-links" aria-label={lang === 'ar' ? 'روابط الخدمات' : 'Service links'}>
          {feature.map(([path, label]) => <Link key={path} href={prefix(lang, path)}>{label}</Link>)}
        </nav>
        <div className="footer-top">
          {brand}
          <p>{rich(t('footerBrand'))}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <div className="curriculum-credit"><span>{t('curriculumCredit')}</span><img src="/v3/ye-credit.webp" loading="lazy" width={112} height={62} alt="Young Engineers" /></div>
        </div>
        <SocialLinks lang={lang} />
        <div className="footer-bottom">
          <span>© {year} FunAdemy</span>
          <a href="https://funademy.io" target="_blank" rel="noopener">funademy.io ↗</a>
          <span>{t('footerTag')}</span>
          <a href="#main" className="back-top"><span>{t('backTop')}</span> ↑</a>
        </div>
      </footer>
      <button className="motion-toggle" type="button" aria-pressed={paused} onClick={() => setPaused((p) => !p)} data-testid="button-motion">{t(paused ? 'resumeMotion' : 'pauseMotion')}</button>
    </div>
  );
}
