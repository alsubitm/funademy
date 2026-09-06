'use client';

import { waLink } from '@/lib/constants';
import { trackEvent } from '@/lib/analytics';

type Props = {
  msg: string;
  className?: string;
  children: React.ReactNode;
};

export function TrackedWaLink({ msg, className, children }: Props) {
  const link = waLink(msg);

  const handleClick = () => {
    trackEvent('whatsapp_outbound_click', { surface: 'contact_page' });
    fetch('/svc/clicks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'whatsapp', page: '/contact' }),
    }).catch(() => {});
  };

  return (
    <a href={link} className={className} onClick={handleClick} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}
