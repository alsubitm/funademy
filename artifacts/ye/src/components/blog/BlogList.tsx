import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import './blog.css';

type Post = {
  id: number;
  slug: string;
  titleAr: string;
  titleEn: string | null;
  excerptAr: string;
  excerptEn: string | null;
  coverEmoji: string;
  publishedAt: Date;
};

export function BlogList({ posts, lang, unavailable = false }: { posts: Post[]; lang: 'ar' | 'en'; unavailable?: boolean }) {
  const ar = lang === 'ar';
  const base = ar ? '/blog' : '/en/blog';

  return (
    <>
      <SiteHeader lang={lang} />
      <SandStripe />
      <main id="main-content" className="blog-pg">
        <div className="b-hero">
          <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>BLOG</span>
          <h1>{ar ? 'المدونة' : 'Blog'}</h1>
          <p>
            {ar
              ? 'مقالات ونصائح للأهالي حول التعلم بالهندسة واللعب وتنمية مهارات الأطفال.'
              : 'Articles and tips for parents on learning through engineering, play, and building kids’ skills.'}
          </p>
        </div>

        {unavailable ? (
          <p className="b-empty" role="alert">
            {ar ? 'المدونة غير متاحة مؤقتاً. يرجى إعادة المحاولة بعد قليل.' : 'The blog is temporarily unavailable. Please try again shortly.'}
          </p>
        ) : posts.length === 0 ? (
          <p className="b-empty">{ar ? 'لا توجد مقالات منشورة بعد.' : 'No articles published yet.'}</p>
        ) : (
          <div className="b-grid wrap">
            {posts.map((p) => (
              <Link key={p.id} href={`${base}/${p.slug}`} className="b-card">
                <div className="b-emoji" aria-hidden>{p.coverEmoji}</div>
                <div className="b-date">
                  {new Date(p.publishedAt).toLocaleDateString(ar ? 'ar-SA' : 'en-US', {
                    year: 'numeric', month: 'long', day: 'numeric',
                  })}
                </div>
                <h2>{(!ar && p.titleEn) || p.titleAr}</h2>
                <p>{(!ar && p.excerptEn) || p.excerptAr}</p>
                <span className="b-more">{ar ? 'اقرأ المقال ←' : 'Read article →'}</span>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SandStripe />
      <SiteFooter lang={lang} />
      <WhatsAppFloat lang={lang} />
    </>
  );
}
