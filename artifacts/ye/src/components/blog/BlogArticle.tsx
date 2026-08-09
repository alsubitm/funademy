import Link from 'next/link';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import './blog.css';

type Post = {
  slug: string;
  titleAr: string;
  titleEn: string | null;
  contentAr: string;
  contentEn: string | null;
  coverEmoji: string;
  publishedAt: Date;
};

/** Renders simple markdown-ish content: blank-line paragraphs + **bold**. */
function Paragraphs({ text }: { text: string }) {
  return (
    <>
      {text.split(/\n\s*\n/).map((para, i) => {
        const parts = para.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
        return (
          <p key={i}>
            {parts.map((part, j) =>
              part.startsWith('**') && part.endsWith('**')
                ? <strong key={j}>{part.slice(2, -2)}</strong>
                : part.split('\n').flatMap((line, k, arr) =>
                    k < arr.length - 1 ? [line, <br key={`${j}-${k}`} />] : [line])
            )}
          </p>
        );
      })}
    </>
  );
}

export function BlogArticle({ post, lang }: { post: Post; lang: 'ar' | 'en' }) {
  const ar = lang === 'ar';
  const title = (!ar && post.titleEn) || post.titleAr;
  const content = (!ar && post.contentEn) || post.contentAr;
  // Fall back to Arabic direction when no English translation exists.
  const contentIsAr = ar || !post.contentEn;

  return (
    <>
      <SiteHeader lang={lang} />
      <SandStripe />
      <main className="blog-pg">
        <article className="b-article wrap">
          <Link href={ar ? '/blog' : '/en/blog'} className="b-back">
            {ar ? '→ العودة إلى المدونة' : '← Back to blog'}
          </Link>
          <div className="b-emoji big" aria-hidden>{post.coverEmoji}</div>
          <div className="b-date">
            {new Date(post.publishedAt).toLocaleDateString(ar ? 'ar-SA' : 'en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </div>
          <h1 dir={contentIsAr ? 'rtl' : 'ltr'}>{ar ? post.titleAr : title}</h1>
          <div className="b-body" dir={contentIsAr ? 'rtl' : 'ltr'}>
            <Paragraphs text={content} />
          </div>
        </article>
      </main>
      <SandStripe />
      <SiteFooter lang={lang} />
      <WhatsAppFloat lang={lang} />
    </>
  );
}
