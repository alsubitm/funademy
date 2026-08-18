export const revalidate = 300;
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';
import { prisma } from '@/lib/db';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  const ogImage = `${base}/og-default.jpg`;
  const arTitle = 'FunAdemy — برامج STEM وليغو للأطفال في الرياض';
  const arDesc = 'تعليم STEM عبر نماذج LEGO® للأطفال من ٤–١٨ سنة. حصص أونلاين وحضورية في الرياض.';
  return {
    title: { absolute: `${arTitle} | e² Young Engineers` },
    description: 'تعليم STEM وهندسة الروبوتات عبر نماذج LEGO® المتحركة للأطفال من ٤ إلى ١٨ سنة في الرياض. سجّل طفلك الآن — حصص أونلاين وحضورية.',
    openGraph: {
      siteName: 'FunAdemy',
      type: 'website',
      locale: 'ar_SA',
      url: `${base}/`,
      title: arTitle,
      description: arDesc,
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'FunAdemy — e² Young Engineers Riyadh' }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@YEYoungEngineers',
      title: arTitle,
      description: arDesc,
      images: [ogImage],
    },
    alternates: {
      canonical: `${base}/`,
      languages: {
        'x-default': `${base}/`,
        'ar-SA': `${base}/`,
        'en': `${base}/en`,
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
      <SiteHeader lang="ar" />
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
      <SiteFooter lang="ar" />
      <WhatsAppFloat lang="ar" />
    </>
  );
}
