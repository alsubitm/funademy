import type { ReactNode } from 'react';
import styles from './SocialLinks.module.css';

type Account = { name: string; url: string; key: string; icon: ReactNode };

const accounts: Account[] = [
  {
    name: 'Instagram', key: 'instagram', url: 'https://www.instagram.com/funademy_sa/',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="5" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    name: 'X', key: 'x', url: 'https://twitter.com/funademy',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3zm-1.08 16.18h1.7L7.4 4.73H5.58l11.09 14.45z" />
      </svg>
    ),
  },
  {
    name: 'Facebook', key: 'facebook', url: 'https://www.facebook.com/funademy.sa/',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M13.5 21v-7.5h2.53l.38-2.94H13.5V8.69c0-.85.24-1.43 1.46-1.43h1.55V4.63A20.8 20.8 0 0 0 14.25 4.5c-2.24 0-3.77 1.37-3.77 3.88v2.18H7.95v2.94h2.53V21h3.02z" />
      </svg>
    ),
  },
  {
    name: 'YouTube', key: 'youtube', url: 'https://www.youtube.com/@funademy',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M21.6 7.2a2.5 2.5 0 0 0-1.77-1.77C18.27 5 12 5 12 5s-6.27 0-7.83.43A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.77 1.77C5.73 19 12 19 12 19s6.27 0 7.83-.43a2.5 2.5 0 0 0 1.77-1.77A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3L10 15z" />
      </svg>
    ),
  },
  {
    name: 'TikTok', key: 'tiktok', url: 'https://www.tiktok.com/@funademy.io',
    icon: (
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M16.6 3c.3 2.2 1.6 3.7 3.9 3.9v3a7 7 0 0 1-3.9-1.2v6.1A5.8 5.8 0 1 1 10.8 9v3.1a2.8 2.8 0 1 0 2.8 2.8V3h3z" />
      </svg>
    ),
  },
  {
    name: 'Snapchat', key: 'snapchat', url: 'https://www.snapchat.com/add/FunAdemy',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 3c3 0 5 2.2 5 5.2v2.3c.6.2 1.3 0 1.8-.2.6.4.4 1-.3 1.3-.6.3-1.5.5-1.5 1 .4 1.4 1.8 3 3.5 3.4-.2.7-1.3.9-2.2 1-.2.4-.1 1-.5 1.1-.8.1-1.7-.3-2.8.3-.9.5-1.7 1.6-3 1.6s-2.1-1.1-3-1.6c-1.1-.6-2-.2-2.8-.3-.4-.1-.3-.7-.5-1.1-.9-.1-2-.3-2.2-1 1.7-.4 3.1-2 3.5-3.4 0-.5-.9-.7-1.5-1-.7-.3-.9-.9-.3-1.3.5.2 1.2.4 1.8.2V8.2C7 5.2 9 3 12 3z" />
      </svg>
    ),
  },
];

export function SocialLinks({ lang }: { lang: 'ar' | 'en' }) {
  const newTab = lang === 'ar' ? 'يفتح في علامة تبويب جديدة' : 'opens in a new tab';
  return (
    <nav id="social-accounts" className={styles.social} aria-label={lang === 'ar' ? 'حسابات التواصل الاجتماعي' : 'Social media accounts'}>
      <span className={styles.heading}>{lang === 'ar' ? 'تابعونا' : 'Follow us'}</span>
      <ul className={styles.links}>
        {accounts.map(({ name, url, key, icon }) => (
          <li key={key}>
            <a href={url} target="_blank" rel="noopener noreferrer" className={styles.link}
              data-platform={key} aria-label={`${name} — ${newTab}`}>
              <span className={styles.icon} aria-hidden="true">{icon}</span>
              <span className={styles.name} dir="ltr">{name}</span>
              <svg className={styles.arrow} aria-hidden="true" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 11l6-6M6 5h5v5" />
              </svg>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
