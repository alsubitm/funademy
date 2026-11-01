import { Fragment, type ReactNode } from 'react';
import { copy, type CopyKey } from './data';

export type Lang = 'ar' | 'en';

export const tr = (lang: Lang, key: CopyKey): string =>
  ((copy[lang] as Record<string, string>)[key] ?? (copy.en as Record<string, string>)[key] ?? key);

/** Renders the reference's tiny inline markup (<br> and <span>) safely as React nodes. */
export function rich(text: string): ReactNode {
  const parts = text.split(/(<br>|<span>.*?<\/span>)/g).filter(Boolean);
  return parts.map((part, index) => {
    if (part === '<br>') return <br key={index} />;
    const span = part.match(/^<span>(.*)<\/span>$/);
    if (span) return <span key={index}>{span[1]}</span>;
    return <Fragment key={index}>{part}</Fragment>;
  });
}

export const prefix = (lang: Lang, path: string) => (lang === 'ar' ? path : `/en${path === '/' ? '' : path}`);
