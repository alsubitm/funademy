'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { CopyKey } from './data';
import { curriculum, curriculumPrograms, type Program } from '@/config/curriculum';
import { prefix, tr, type Lang } from './shared';

const FILTERS: [string, CopyKey][] = [['all', 'filterAll'], ['building', 'filterBuild'], ['coding', 'filterCode'], ['robotics', 'filterRobot']];

export function Programs({ lang, onEnquire }: { lang: Lang; onEnquire: (p: Program) => void }) {
  const t = (k: CopyKey) => tr(lang, k);
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Program | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const lastButton = useRef<HTMLButtonElement | null>(null);
  const programs = curriculumPrograms();
  const list = programs.filter((p) => filter === 'all' || p.category === filter);
  const ageText = (p: Program) => `${t('ages')} ${p.age} ${t('years')}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => { document.body.style.overflow = ''; if (lastButton.current?.isConnected) lastButton.current.focus(); };
    dialog.addEventListener('close', onClose);
    return () => { dialog.removeEventListener('close', onClose); document.body.style.overflow = ''; };
  }, []);

  const open = (p: Program, btn: HTMLButtonElement) => {
    setSelected(p); lastButton.current = btn;
    dialogRef.current?.showModal(); document.body.style.overflow = 'hidden';
  };
  const close = () => dialogRef.current?.close();

  return (
    <section className="programs section-wrap" id="programs">
      <div className="section-heading reveal"><div><p className="eyebrow">{t('programEyebrow')}</p><h2><span>{t('programTitle1')}</span><br /><span className="serif-word">{t('programTitle2')}</span></h2></div><p>{t('programIntro')}</p></div>
      {programs.length === 0 ? (
        <div className="program-empty" data-testid="status-programs-empty">
          <span className="program-empty-mark" aria-hidden="true">✦</span>
          {lang === 'ar' ? (
            <div><h3>نجهّز المغامرات الآن.</h3><p>دورة يناير 2027 أونلاين قيد التجهيز. للمجموعات الحالية زر صفحة التسجيل، أو احجز حصة تجريبية.</p></div>
          ) : (
            <div><h3>The adventures are being prepared.</h3><p>The January 2027 online course is in preparation. For current groups, see the enrolment page, or book a trial.</p></div>
          )}
          <Link href={prefix(lang, '/book')} className="button button-blue" data-testid="link-programs-empty-book"><span>{t('serviceBook')}</span><span aria-hidden="true">↗</span></Link>
        </div>
      ) : (<>
      <div className="program-toolbar">
        <div className="filter-tabs" aria-label="Filter programs">
          {FILTERS.map(([id, key]) => (
            <button key={id} type="button" className={filter === id ? 'active' : ''} aria-pressed={filter === id} onClick={() => setFilter(id)} data-testid={`button-filter-${id}`}>{t(key)}</button>
          ))}
        </div>
        <span className="program-count" aria-live="polite">{`${list.length} ${t('programCount')}`}</span>
      </div>
      <div className="program-grid">
        {list.map((p) => (
          <article className="program-card" key={p.id}>
            <div className={`program-picture${p.photo ? ' has-photo' : ''}`}>
              <span className="card-age">{ageText(p)}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt={curriculum ? (p.photo ? curriculum.illustrationAlt : curriculum.modelImageAlt)[lang] : ''} loading="lazy" width={800} height={660} />
            </div>
            <p className="card-category">{t(p.categoryKey)}</p>
            <h3>{p.name}</h3>
            <p className="card-description">{p.short[lang]}</p>
            <button className="card-link" type="button" aria-label={`${t('cardCta')} — ${p.name}`} data-testid={`button-program-${p.id}`} onClick={(e) => open(p, e.currentTarget)}>
              <span>{t('cardCta')}</span><span aria-hidden="true">↗</span>
            </button>
          </article>
        ))}
      </div>
      </>)}
      <div className="program-bottom"><p>{t('programNote')}</p><a href="#contact" className="text-link"><span>{t('guideMe')}</span><span aria-hidden="true">↗</span></a></div>

      <dialog ref={dialogRef} className="program-dialog" aria-labelledby="dialog-title"
        onClick={(e) => {
          if (e.target !== dialogRef.current) return;
          const r = dialogRef.current.getBoundingClientRect();
          if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close();
        }}>
        <button type="button" className="dialog-close" aria-label={t('closeDialog')} onClick={close} data-testid="button-dialog-close">×</button>
        {selected && (
          <>
            <p className="eyebrow">{t(selected.categoryKey)}</p>
            <h2 id="dialog-title">{selected.name}</h2>
            <p className="dialog-age">{ageText(selected)}</p>
            <p>{selected.description[lang]}</p>
            <h3>{t('dialogDiscover')}</h3>
            <ul>{selected.skills[lang].map((s) => <li key={s}>{s}</li>)}</ul>
            <p className="dialog-note">{t('dialogNote')}</p>
            <div className="dialog-actions">
              <a href="#contact" className="button button-blue" data-testid="button-dialog-enquire" onClick={() => { onEnquire(selected); close(); }}>
                <span>{t('dialogCta')}</span><span aria-hidden="true">↗</span>
              </a>
              <Link href={prefix(lang, '/book')} className="text-link" data-testid="link-dialog-book"><span>{t('serviceBook')}</span><span aria-hidden="true">↗</span></Link>
            </div>
          </>
        )}
      </dialog>
    </section>
  );
}
