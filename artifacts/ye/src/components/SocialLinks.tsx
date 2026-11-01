import styles from './SocialLinks.module.css';

const accounts = [
  { name: 'Instagram', url: 'https://www.instagram.com/funademy_sa/' },
  { name: 'X', url: 'https://twitter.com/funademy' },
  { name: 'Facebook', url: 'https://www.facebook.com/funademy.sa/' },
  { name: 'YouTube', url: 'https://www.youtube.com/@funademy' },
];

export function SocialLinks({ lang }: { lang: 'ar' | 'en' }) {
  return (
    <nav id="social-accounts" className={styles.social} aria-label={lang === 'ar' ? 'حسابات التواصل الاجتماعي' : 'Social media accounts'}>
      <span className={styles.heading}>{lang === 'ar' ? 'تابعونا' : 'Follow us'}</span>
      <div className={styles.links}>
        {accounts.map(({ name, url }) => (
          <a key={name} href={url} target="_blank" rel="noopener noreferrer"
            aria-label={`${name} — ${lang === 'ar' ? 'يفتح في علامة تبويب جديدة' : 'opens in a new tab'}`}>
            <span dir="ltr">{name}</span><span aria-hidden="true">↗</span>
          </a>
        ))}
      </div>
    </nav>
  );
}
