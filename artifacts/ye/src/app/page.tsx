export const revalidate = 300;
import { prisma } from '@/lib/db';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { LiveTicker } from '@/components/LiveTicker';
import { Hero } from '@/components/home/Hero';
import { Stats } from '@/components/home/Stats';
import { PathMap } from '@/components/home/PathMap';
import { Kits } from '@/components/home/Kits';
import { Workshop } from '@/components/home/Workshop';
import { Territory } from '@/components/home/Territory';
import { Testimonials } from '@/components/home/Testimonials';
import { Pricing } from '@/components/home/Pricing';
import { FAQ } from '@/components/home/FAQ';

export default async function HomePage() {
  const slots = await prisma.scheduleSlot.findMany({
    where: { active: true },
    include: { program: true },
    orderBy: [{ weekday: 'asc' }, { time: 'asc' }],
    take: 10,
  });

  const programs = await prisma.program.findMany({
    orderBy: { position: 'asc' },
  });

  const faqs = await prisma.faqEntry.findMany({
    where: { published: true },
    orderBy: { position: 'asc' },
  });

  return (
    <>
      <SiteHeader lang="ar" />
      <Hero lang="ar" />
      <LiveTicker slots={slots} lang="ar" />
      <SandStripe />
      <Stats lang="ar" />
      <PathMap lang="ar" />
      <Kits programs={programs} lang="ar" />
      <Workshop lang="ar" />
      <Territory lang="ar" />
      <Testimonials lang="ar" />
      <Pricing lang="ar" />
      <FAQ faqs={faqs} lang="ar" />
      <SandStripe />
      <SiteFooter lang="ar" />
      <WhatsAppFloat lang="ar" />
    </>
  );
}
