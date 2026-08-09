'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function LangSwitcher({ lang }: { lang: 'ar' | 'en' }) {
  const pathname = usePathname();

  // Compute the equivalent path in the other language
  const targetHref =
    lang === 'ar'
      ? // Arabic → English: prepend /en
        pathname === '/' ? '/en' : `/en${pathname}`
      : // English → Arabic: strip leading /en
        pathname.replace(/^\/en/, '') || '/';

  return (
    <Link
      href={targetHref}
      aria-label={lang === 'ar' ? 'Switch to English' : 'التبديل للعربية'}
      className="lang-switcher"
    >
      <span className={lang === 'ar' ? 'active' : ''}>ع</span>
      <span className="sep">|</span>
      <span className={lang === 'en' ? 'active' : ''}>EN</span>
    </Link>
  );
}
