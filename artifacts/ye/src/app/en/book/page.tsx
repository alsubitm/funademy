export const revalidate = 300;
import { prisma, withDbRetry } from '@/lib/db';
import { safeQuery } from '@/lib/safe-query';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { BookingFlow } from '@/components/book/BookingFlow';
import { bookDict } from '@/app/(ar)/book/dict';
import '@/app/(ar)/book/page.css';
import { siteUrl } from '@/lib/site-url';

const _bookBase = siteUrl();
export const metadata = {
  title: 'Book a Trial | FunAdemy',
  description:
    'Register your child for a free trial class with Young Engineers Riyadh and experience building moving LEGO® models. STEM programs for kids aged 4–18 — in-person and online.',
  openGraph: {
    type: 'website',
    locale: 'en_SA',
    title: 'Book a Trial | FunAdemy',
    description: 'Register your child for a free trial class to experience the Young Engineer journey.',
    images: [{ url: `${_bookBase}/og-default.jpg`, width: 1200, height: 630, alt: 'FunAdemy' }],
  },
  twitter: {
    card: 'summary_large_image',
    site: '@YEYoungEngineers',
    title: 'Book a Trial | FunAdemy',
    description: 'Register your child for a free trial class to experience the Young Engineer journey.',
    images: [`${_bookBase}/og-default.jpg`],
  },
  alternates: {
    canonical: `${_bookBase}/en/book`,
    languages: {
      'ar-SA': `${_bookBase}/book`,
      'en-SA': `${_bookBase}/en/book`,
      'x-default': `${_bookBase}/book`,
    },
  },
};

export default async function BookPageEn({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const programParam = typeof sp.program === 'string' ? sp.program : undefined;
  const ageRaw = typeof sp.age === 'string' ? Number(sp.age) : NaN;
  const ageParam = Number.isInteger(ageRaw) && ageRaw >= 4 && ageRaw <= 18 ? ageRaw : undefined;
  const availability = await safeQuery(
    () => withDbRetry(
      () => Promise.all([
        prisma.program.findMany({ orderBy: { position: 'asc' } }),
        prisma.scheduleSlot.findMany({
          where: { active: true },
          orderBy: [{ weekday: 'asc' }, { time: 'asc' }],
        }),
      ]),
      { operation: 'book-en:availability', kind: 'read' },
    ),
    null,
    'book-en:availability',
  );

  const d = bookDict.en;

  return (
    <>
      <SiteHeader lang="en" />
      <SandStripe />
      
      <main id="main-content" className="book-pg">
        <div className="bpgrid light"></div>
        <div className="wrap" style={{ position: 'relative', paddingTop: '60px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>TRIAL CLASS</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px' }}>{d.title}</h1>
            <p className="sub" style={{ margin: '8px auto 0' }}>{d.desc}</p>
          </div>

          {availability ? (
            <BookingFlow
              programs={availability[0]}
              slots={availability[1]}
              lang="en"
              preselectProgramSlug={programParam}
              preselectAge={ageParam}
            />
          ) : (
            <div className="w-box" role="alert">
              <p style={{ textAlign: 'center', color: 'var(--mut)', padding: '32px 16px' }}>
                Booking is temporarily unavailable. Please try again shortly.
              </p>
            </div>
          )}
        </div>
      </main>

      <SandStripe />
      <SiteFooter lang="en" />
      <WhatsAppFloat lang="en" />
    </>
  );
}
