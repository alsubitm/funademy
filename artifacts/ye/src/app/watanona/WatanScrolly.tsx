'use client';

import { useEffect, useRef } from 'react';
import { watanonaDict } from './dictionary';

/**
 * Scroll-driven journey: بيتي → حيّي → مدينتي → وطننا.
 * Each stage reveals when it scrolls into view (IntersectionObserver adds
 * `.on`). Motion is pure CSS so `prefers-reduced-motion` gets a calm fallback
 * (see page.css .scrolly rules).
 */
export function WatanScrolly({ lang }: { lang: 'ar' | 'en' }) {
  const d = watanonaDict[lang];
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const stages = Array.from(root.querySelectorAll('.scrolly-stage'));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) e.target.classList.add('on');
        }
      },
      { threshold: 0.35 },
    );
    stages.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  const art: Record<string, React.ReactNode> = {
    home: (
      <svg viewBox="0 0 120 90" className="scrolly-art" aria-hidden>
        <g className="draw">
          <path d="M30 50 L60 25 L90 50" fill="none" stroke="#FFCA17" strokeWidth="3" strokeLinecap="round" />
          <rect x="38" y="50" width="44" height="30" fill="none" stroke="#22DAFF" strokeWidth="3" />
          <rect x="54" y="62" width="12" height="18" fill="none" stroke="#22DAFF" strokeWidth="2.5" />
        </g>
      </svg>
    ),
    hood: (
      <svg viewBox="0 0 120 90" className="scrolly-art" aria-hidden>
        <g className="draw">
          {[8, 48, 88].map((x, i) => (
            <g key={i}>
              <path d={`M${x} 58 L${x + 12} 46 L${x + 24} 58`} fill="none" stroke="#FFCA17" strokeWidth="2.5" strokeLinecap="round" />
              <rect x={x + 2} y={58} width={20} height={18} fill="none" stroke="#22DAFF" strokeWidth="2.5" />
            </g>
          ))}
          <path d="M4 82 H116" stroke="#E5AE4A" strokeWidth="2" strokeDasharray="6 5" />
        </g>
      </svg>
    ),
    city: (
      <svg viewBox="0 0 120 90" className="scrolly-art" aria-hidden>
        <g className="draw">
          <rect x="10" y="40" width="18" height="42" fill="none" stroke="#22DAFF" strokeWidth="2.5" />
          <rect x="34" y="24" width="20" height="58" fill="none" stroke="#FFCA17" strokeWidth="2.5" />
          <rect x="60" y="34" width="16" height="48" fill="none" stroke="#22DAFF" strokeWidth="2.5" />
          <rect x="82" y="14" width="24" height="68" fill="none" stroke="#E5AE4A" strokeWidth="2.5" />
          {[38, 46, 54].map((y) => <line key={y} x1="86" x2="102" y1={y} y2={y} stroke="#E5AE4A" strokeWidth="1.5" />)}
        </g>
      </svg>
    ),
    nation: (
      <svg viewBox="0 0 120 90" className="scrolly-art" aria-hidden>
        <g className="draw">
          {/* stylized brick-map: staggered brick courses forming a rising silhouette */}
          {[
            [30, 66, 3], [18, 56, 5], [10, 46, 6], [18, 36, 5], [30, 26, 3],
          ].map(([x, y, n], r) => (
            <g key={r}>
              {Array.from({ length: n as number }, (_, i) => (
                <rect key={i} x={(x as number) + i * 16} y={y as number} width={14} height={8}
                  fill="none" stroke={['#FFCA17', '#22DAFF', '#E5AE4A'][(r + i) % 3]} strokeWidth="2" rx="1.5" />
              ))}
            </g>
          ))}
          <path d="M52 14 L60 6 L68 14" fill="none" stroke="#FFCA17" strokeWidth="2.5" strokeLinecap="round" />
        </g>
      </svg>
    ),
  };

  return (
    <section className="sec scrolly-sec" ref={rootRef}>
      <div className="bpgrid light" style={{ opacity: 0.15 }}></div>
      <div className="wrap relative z-10">
        <div style={{ textAlign: 'center' }}>
          <span className="kick" style={{ color: 'var(--color-cyan)', borderColor: 'var(--color-cyan)' }}>
            {d.scrollyKick}
          </span>
          <h2 style={{ color: '#fff' }}>{d.scrollyTitle}</h2>
        </div>
        <div className="scrolly-track">
          {d.scrollyStages.map((s, i) => (
            <div key={s.key} className="scrolly-stage">
              <div className="scrolly-line" aria-hidden>
                <span className="scrolly-dot">{lang === 'ar' ? ['١', '٢', '٣', '٤'][i] : i + 1}</span>
              </div>
              <div className="scrolly-card">
                {art[s.key]}
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
