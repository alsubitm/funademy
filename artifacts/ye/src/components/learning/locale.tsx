'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';

export function useLearningLocale() {
  const pathname = usePathname();
  const en = pathname.startsWith('/en/');
  return {
    en,
    lang: en ? 'en' : 'ar',
    dir: en ? 'ltr' as const : 'rtl' as const,
    t: (ar: string, english: string) => en ? english : ar,
    path: (url: string) => en ? `/en${url}` : url,
    content: (ar: string, english?: string | null) => en ? (english?.trim() || 'English translation unavailable') : ar,
  };
}

export function LearningLanguageSwitch() {
  const pathname = usePathname();
  const search = useSearchParams();
  const en = pathname.startsWith('/en/');
  const target = en ? pathname.slice(3) : `/en${pathname}`;
  return <Link className="learn-language-switch" href={`${target}${search.size ? `?${search}` : ''}`} lang={en ? 'ar' : 'en'} hrefLang={en ? 'ar' : 'en'}>
    {en ? 'العربية' : 'English'}
  </Link>;
}

export function LearningLocaleBar() {
  return <nav style={{ padding: '12px 20px', textAlign: 'end' }} aria-label="Language / اللغة"><LearningLanguageSwitch /></nav>;
}
