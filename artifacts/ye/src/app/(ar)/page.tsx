export const revalidate = 300;
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';
import { prisma } from '@/lib/db';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  const ogImage = `${base}/og-default.jpg`;
  return {
    title: { absolute: 'المهندس الصغير الرياض — برامج STEM بالليغو للأطفال | FunAdemy' },
    description:
      'تعليم STEM عبر نماذج LEGO® للأطفال من ٤ إلى ١٨ سنة في الرياض. سجّل تجربتك المجانية اليوم مع e² Young Engineers — ترخيص فالكون آي.',
    openGraph: {
      siteName: 'FunAdemy',
      type: 'website',
      locale: 'ar_SA',
      url: `${base}/`,
      title: 'المهندس الصغير الرياض — e² Young Engineers',
      description: 'برامج STEM بالليغو للأطفال في الرياض. احجز تجربة مجانية.',
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'FunAdemy — e² Young Engineers Riyadh' }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@YEYoungEngineers',
      title: 'المهندس الصغير الرياض — e² Young Engineers',
      description: 'برامج STEM بالليغو للأطفال في الرياض. احجز تجربة مجانية.',
      images: [ogImage],
    },
    alternates: {
      canonical: `${base}/`,
      languages: {
        'x-default': `${base}/`,
        'ar-SA': `${base}/`,
        'en-SA': `${base}/en`,
      },
    },
  };
}

import { safeQuery } from '@/lib/safe-query';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { LiveTicker } from '@/components/LiveTicker';
import { Hero } from '@/components/home/Hero';
import { Stats } from '@/components/home/Stats';
import { Platforms } from '@/components/home/Platforms';
import { PathMap } from '@/components/home/PathMap';
import { Kits } from '@/components/home/Kits';
import { Workshop } from '@/components/home/Workshop';
import { Territory } from '@/components/home/Territory';
import { Testimonials } from '@/components/home/Testimonials';
import { Pricing } from '@/components/home/Pricing';
import { FAQ } from '@/components/home/FAQ';
import { WatanTeaser } from '@/components/home/WatanTeaser';
import { Certificate } from '@/components/home/Certificate';

export default async function HomePage() {
  const [slots, programs, faqs, testimonials] = await Promise.all([
    safeQuery(() => prisma.scheduleSlot.findMany({
      where: { active: true },
      include: { program: true },
      orderBy: [{ weekday: 'asc' }, { time: 'asc' }],
      take: 10,
    }), [], 'home:slots'),
    safeQuery(() => prisma.program.findMany({
      orderBy: { position: 'asc' },
    }), [], 'home:programs'),
    safeQuery(() => prisma.faqEntry.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
    }), [], 'home:faqs'),
    safeQuery(() => prisma.testimonial.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
    }), [], 'home:testimonials'),
  ]);

  return (
    <>
      {faqs.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'FAQPage',
              mainEntity: faqs.map(faq => ({
                '@type': 'Question',
                name: faq.questionAr,
                acceptedAnswer: { '@type': 'Answer', text: faq.answerAr },
              })),
            }),
          }}
        />
      )}
      <SiteHeader lang="ar" />
      <main id="main-content">
        <Hero lang="ar" />
        <LiveTicker slots={slots} lang="ar" />
        <SandStripe />
        <Stats lang="ar" />
        <Platforms lang="ar" />
        <PathMap lang="ar" />
        <Kits programs={programs} lang="ar" />
        <Workshop lang="ar" />
        <WatanTeaser lang="ar" />
        <Territory lang="ar" />
        <Testimonials lang="ar" testimonials={testimonials} />
        <Pricing lang="ar" />
        <Certificate lang="ar" />
        <FAQ faqs={faqs} lang="ar" />
        <SandStripe />
      </main>
      <SiteFooter lang="ar" />
      <WhatsAppFloat lang="ar" />
    </>
  );
}
