'use client';

import { usePathname } from 'next/navigation';
import { ChatAssistant } from './ChatAssistant';

const PRIVATE_SEGMENTS = ['/admin', '/portal', '/account', '/learn', '/help'];

export function PublicChatMount({ lang }: { lang: 'ar' | 'en' }) {
  const pathname = usePathname();
  const localizedPath = lang === 'en' && pathname.startsWith('/en') ? pathname.slice(3) || '/' : pathname;
  if (PRIVATE_SEGMENTS.some((segment) => localizedPath === segment || localizedPath.startsWith(`${segment}/`))) return null;
  return <ChatAssistant lang={lang} />;
}