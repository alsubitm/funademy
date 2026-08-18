export const revalidate = 300;
import type { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';
import { prisma } from '@/lib/db';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  return {
    title: { absolute: 'FunAdemy — e² Young Engineers Riyadh | STEM for Kids' },
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
    safeQuery(() => prisma.scheduleSlot.findMany({
      where: { active: true },
      include: { program: true },
      orderBy: [{ weekday: 'asc' }, { time: 'asc' }],
      take: 10,
    }), [], 'home-en:slots'),
    safeQuery(() => prisma.program.findMany({
      orderBy: { position: 'asc' },
    }), [], 'home-en:programs'),
    safeQuery(() => prisma.faqEntry.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
    }), [], 'home-en:faqs'),
    safeQuery(() => prisma.testimonial.findMany({
      where: { published: true },
      orderBy: { position: 'asc' },
    }), [], 'home-en:testimonials'),
  ]);

  return (
    <>
      <SiteHeader lang="en" />
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
      <SiteFooter lang="en" />
      <WhatsAppFloat lang="en" />
    </>
  );
}
