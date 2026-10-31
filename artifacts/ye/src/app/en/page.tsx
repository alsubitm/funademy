export const revalidate = 300;
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';
import { prisma, withDbRetry } from '@/lib/db';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  return {
    title: { absolute: 'FunAdemy — Where Fun Meets Academy | Live STEM for Kids' },
    description:
      'STEM education through moving LEGO® models for children aged 4–18. Online and in-person classes in Riyadh. e² Young Engineers, Falcon Eye license.',
    alternates: {
      canonical: `${base}/en`,
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

export default async function EnglishHomePage() {
  const [slots, programs, faqs, testimonials] = await Promise.all([
    safeQuery(() => withDbRetry(() => prisma.scheduleSlot.findMany({
      where: { active: true },
      include: { program: true },
      orderBy: [{ weekday: 'asc' }, { time: 'asc' }],
      take: 10,
    }), { operation: 'home-en:slots', kind: 'read' }), [], 'home-en:slots'),
    safeQuery(() => withDbRetry(() => prisma.program.findMany({
      orderBy: { position: 'asc' },
    }), { operation: 'home-en:programs', kind: 'read' }), [], 'home-en:programs'),
    safeQuery(() => withDbRetry(() => prisma.faqEntry.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
    }), { operation: 'home-en:faqs', kind: 'read' }), [], 'home-en:faqs'),
    safeQuery(() => withDbRetry(() => prisma.testimonial.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
    }), { operation: 'home-en:testimonials', kind: 'read' }), [], 'home-en:testimonials'),
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
                name: faq.questionEn,
                acceptedAnswer: { '@type': 'Answer', text: faq.answerEn },
              })),
            }),
          }}
        />
      )}
      <SiteHeader lang="en" />
      <main id="main-content" className="v9">
        <Hero lang="en" />
        <LiveTicker slots={slots} lang="en" />
        <SandStripe />
        <Stats lang="en" />
        <Platforms lang="en" />
        <PathMap lang="en" />
        <Kits programs={programs} lang="en" />
        <Workshop lang="en" />
        <WatanTeaser lang="en" />
        <Territory lang="en" />
        <Testimonials lang="en" testimonials={testimonials} />
        <Pricing lang="en" />
        <Certificate lang="en" />
        <FAQ faqs={faqs} lang="en" />
        <SandStripe />
      </main>
      <SiteFooter lang="en" />
      <WhatsAppFloat lang="en" />
    </>
  );
}
