'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

export const PORTAL_SECTIONS = ['upcoming', 'enrollments', 'attendance', 'skills', 'payments'] as const;
type Section = (typeof PORTAL_SECTIONS)[number];

/**
 * Child switcher + section navigation. Every link carries ?child=<id> so the
 * selected child is never lost; switching child keeps the current #section.
 */
export function PortalNav({ base, childId, kids, labels, sectionLabels, childLabel, sectionsLabel }: {
  base: string;
  childId: number;
  kids: { id: number; firstName: string; birthYear: number | null }[];
  labels: Record<Section, string>;
  sectionLabels: Record<Section, string | number>;
  childLabel: string;
  sectionsLabel: string;
}) {
  const [hash, setHash] = useState('');
  useEffect(() => {
    const read = () => {
      const h = window.location.hash.replace('#ptl-', '');
      setHash((PORTAL_SECTIONS as readonly string[]).includes(h) ? `#ptl-${h}` : '');
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);

  return (
    <>
      {(
        <nav className="ptl-switch" aria-label={childLabel} data-testid="nav-portal-children">
          {kids.map((s) => (
            <Link
              key={s.id}
              className={`ptl-kid ${s.id === childId ? 'sel' : ''}`}
              aria-current={s.id === childId ? 'page' : undefined}
              href={`${base}/portal?child=${s.id}${hash}`}
              data-testid={`link-portal-child-${s.id}`}
            >
              <span className="dot" aria-hidden="true" />
              {s.firstName}
              {s.birthYear && <small dir="ltr">{s.birthYear}</small>}
            </Link>
          ))}
        </nav>
      )}
      <nav className="ptl-secnav" aria-label={sectionsLabel} data-testid="nav-portal-sections">
        {PORTAL_SECTIONS.map((id) => (
          <a
            key={id}
            href={`${base}/portal?child=${childId}#ptl-${id}`}
            aria-current={hash === `#ptl-${id}` ? 'location' : undefined}
            data-testid={`link-portal-section-${id}`}
          >
            <span>{labels[id]}</span>
            <b>{sectionLabels[id]}</b>
          </a>
        ))}
      </nav>
    </>
  );
}
