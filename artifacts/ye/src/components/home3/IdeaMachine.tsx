'use client';

import { useEffect, useRef, useState } from 'react';
import { ideas } from './data';
import { rich, tr, type Lang } from './shared';

const CATS = [
  { id: 'building', icon: '▤', label: 'ideaBuilding', meta: 'ideaCategoryBuilding' },
  { id: 'coding', icon: '{ }', label: 'ideaCoding', meta: 'ideaCategoryCoding' },
  { id: 'robotics', icon: '⚙', label: 'ideaRobotics', meta: 'ideaCategoryRobotics' },
] as const;

export function IdeaMachine({ lang }: { lang: Lang }) {
  const t = (k: Parameters<typeof tr>[1]) => tr(lang, k);
  const [category, setCategory] = useState<(typeof CATS)[number]['id']>('building');
  const [current, setCurrent] = useState(0);
  const [shuffling, setShuffling] = useState(false);
  const [tick, setTick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const animate = () => {
    if (timer.current) clearTimeout(timer.current);
    setShuffling(false);
    setTick((n) => n + 1);
    requestAnimationFrame(() => setShuffling(true));
    timer.current = setTimeout(() => setShuffling(false), 650);
  };

  const item = ideas[category][current];
  const content = item[lang];
  const meta = CATS.find((c) => c.id === category)!;

  return (
    <section className="fidea" id="idea-machine" aria-labelledby="fidea-heading">
      <div className="fidea-inner">
        <div className="fidea-intro">
          <p className="eyebrow"><span className="fidea-live" aria-hidden="true" /> <span>{t('ideaEyebrow')}</span></p>
          <h2 id="fidea-heading"><span>{t('ideaHeading1')}</span><br /><span className="fidea-underlined">{t('ideaHeading2')}</span></h2>
          <p className="fidea-description">{t('ideaDescription')}</p>
          <div className="fidea-path" aria-hidden="true"><span>✳</span><svg width="146" height="58" viewBox="0 0 146 58" fill="none"><path d="M3 12c29 49 88 47 126 8M117 14l18 1-1 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="5 7" /></svg><em>{t('ideaPath')}</em></div>
          <p className="fidea-footnote">{t('ideaFootnote')}</p>
        </div>
        <div className="fidea-workshop">
          <span className="fidea-orbit fidea-orbit-one" aria-hidden="true">✦</span><span className="fidea-orbit fidea-orbit-two" aria-hidden="true">+</span>
          <div className={`fidea-machine${shuffling ? ' is-shuffling' : ''}`}>
            <div className="fidea-antenna" aria-hidden="true"><i /></div>
            <div className="fidea-machine-top"><span className="fidea-machine-name">{t('ideaMachineName')}</span><span className="fidea-lights" aria-hidden="true"><i /><i /><i /></span></div>
            <div className="fidea-screen" aria-live="polite" aria-atomic="true" key={tick}>
              <div className="fidea-screen-meta"><span>{t(meta.meta)}</span><span aria-hidden="true">✳</span></div>
              <span className="fidea-prompt-icon" aria-hidden="true">{item.icon}</span>
              <h3>{content[0]}</h3>
              <p>{content[1]}</p>
              <div className="fidea-thought"><span aria-hidden="true">↗</span><span>{content[2]}</span></div>
            </div>
            <div className="fidea-controls">
              <div className="fidea-categories" role="group" aria-label={t('ideaCategories')}>
                {CATS.map((c) => (
                  <button key={c.id} type="button" className={category === c.id ? 'is-selected' : ''} aria-pressed={category === c.id} data-testid={`button-idea-${c.id}`}
                    onClick={() => { if (category === c.id) return; setCategory(c.id); setCurrent(0); animate(); }}>
                    <span aria-hidden="true">{c.icon}</span><span>{t(c.label)}</span>
                  </button>
                ))}
              </div>
              <button className="fidea-generate" type="button" data-testid="button-idea-generate"
                onClick={() => { const len = ideas[category].length; setCurrent((cur) => (cur + 1 + Math.floor(Math.random() * (len - 1))) % len); animate(); }}>
                <span className="fidea-generate-icon" aria-hidden="true">✳</span><span>{t('ideaSurprise')}</span><span aria-hidden="true">↗</span>
              </button>
              <div className="fidea-machine-bottom"><span><i aria-hidden="true" /><span>{t('ideaPowered')}</span></span><span aria-hidden="true">FUN / 001</span></div>
            </div>
          </div>
          <span className="fidea-sticker"><span aria-hidden="true">∞</span><span>{rich(t('ideaSticker'))}</span></span>
        </div>
      </div>
    </section>
  );
}
