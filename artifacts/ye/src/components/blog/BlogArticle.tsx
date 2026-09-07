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
  coverImageUrl: string | null;
  publishedAt: Date;
};

type RelatedPost = {
  slug: string;
  titleAr: string;
  titleEn: string | null;
  excerptAr: string;
  excerptEn: string | null;
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

export function BlogArticle({
  post,
  lang,
  relatedPosts = [],
}: {
  post: Post;
  lang: 'ar' | 'en';
  relatedPosts?: RelatedPost[];
}) {
  const ar = lang === 'ar';
  const title = (!ar && post.titleEn) || post.titleAr;
  const content = (!ar && post.contentEn) || post.contentAr;
  // Fall back to Arabic direction when no English translation exists.
  const contentIsAr = ar || !post.contentEn;
  const blogBase = ar ? '/blog' : '/en/blog';
  const bookHref = ar ? '/book' : '/en/book';

  return (
    <>
      <SiteHeader lang={lang} />
      <SandStripe />
      <main id="main-content" className="blog-pg">
        <article className="b-article wrap">
          <Link href={blogBase} className="b-back">
            {ar ? '→ العودة إلى المدونة' : '← Back to blog'}
          </Link>
          {post.coverImageUrl ? (
            // Plain <img> is intentional: coverImageUrl may be any validated
            // HTTPS URL, and next/image requires remotePatterns for external
            // hosts. A standard img element works for all origins without
            // server-side optimisation config.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="b-cover-img"
              src={post.coverImageUrl}
              alt={title}
              width={1200}
              height={630}
              style={{ width: '100%', height: 'auto', borderRadius: 12, display: 'block' }}
            />
          ) : (
            <div className="b-emoji big" aria-hidden>{post.coverEmoji}</div>
          )}
          <div className="b-date">
            {new Date(post.publishedAt).toLocaleDateString(ar ? 'ar-SA' : 'en-US', {
              year: 'numeric', month: 'long', day: 'numeric',
            })}
          </div>
          <h1 dir={contentIsAr ? 'rtl' : 'ltr'}>{ar ? post.titleAr : title}</h1>
          <div className="b-body" dir={contentIsAr ? 'rtl' : 'ltr'}>
            <Paragraphs text={content} />
          </div>

          {/* Contextual CTA — links to booking flow */}
          <div className="b-cta-box">
            <div className="b-cta-emoji" aria-hidden>🚀</div>
            <div>
              <strong>
                {ar
                  ? 'هل أعجبك ما قرأت؟ جرّب برامجنا مجاناً!'
                  : 'Interested in our programs?'}
              </strong>
              <p>
                {ar
                  ? 'احجز حصة تجريبية مجانية لطفلك وشاهد كيف نجعل التعلم متعة حقيقية.'
                  : 'Book a free trial class and see how we make learning genuinely fun for kids ages 4–18.'}
              </p>
            </div>
            <Link href={bookHref} className="btn y">
              {ar ? 'احجز حصة تجريبية مجانية' : 'Book a free trial class'}
            </Link>
          </div>
        </article>

        {/* Related articles */}
        {relatedPosts.length > 0 && (
          <div className="b-related wrap">
            <h2 className="b-related-title">
              {ar ? 'مقالات ذات صلة' : 'Related articles'}
            </h2>
            <div className="b-grid">
              {relatedPosts.map((p) => (
                <Link key={p.slug} href={`${blogBase}/${p.slug}`} className="b-card">
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
          </div>
        )}
      </main>
      <SandStripe />
      <SiteFooter lang={lang} />
      <WhatsAppFloat lang={lang} />
    </>
  );
}

export function BlogArticleUnavailable({ lang }: { lang: 'ar' | 'en' }) {
  const ar = lang === 'ar';
  return (
    <>
      <SiteHeader lang={lang} />
      <SandStripe />
      <main id="main-content" className="blog-pg">
        <div className="b-article wrap">
          <p className="b-empty" role="alert">
            {ar
              ? 'المقال غير متاح مؤقتاً. يرجى إعادة المحاولة بعد قليل.'
              : 'This article is temporarily unavailable. Please try again shortly.'}
          </p>
        </div>
      </main>
      <SandStripe />
      <SiteFooter lang={lang} />
      <WhatsAppFloat lang={lang} />
    </>
  );
}
