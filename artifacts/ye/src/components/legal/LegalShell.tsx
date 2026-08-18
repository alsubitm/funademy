import type { ReactNode } from 'react';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';

/** Shared shell for policy/compliance pages (privacy, terms, NELC readiness). */
export function LegalShell({
  lang,
  kick,
  title,
  intro,
  updated,
  children,
}: {
  lang: 'ar' | 'en';
  kick: string;
  title: string;
  intro?: string;
  updated?: string;
  children: ReactNode;
}) {
  return (
    <>
      <SiteHeader lang={lang} />
      <SandStripe />
      <main id="main-content" className="legal">
        <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>{kick}</span>
        <h1>{title}</h1>
        {intro ? <p className="intro">{intro}</p> : null}
        {updated ? <p className="updated">{updated}</p> : null}
        {children}
      </main>
      <SandStripe />
      <SiteFooter lang={lang} />
      <WhatsAppFloat lang={lang} />
    </>
  );
}
