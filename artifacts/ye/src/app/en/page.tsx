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
import { WatanTeaser } from '@/components/home/WatanTeaser';
import { Certificate } from '@/components/home/Certificate';

export default async function EnglishHomePage() {
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
      <SiteHeader lang="en" />
      <Hero lang="en" />
      <LiveTicker slots={slots} lang="en" />
      <SandStripe />
      <Stats lang="en" />
      <PathMap lang="en" />
      <Kits programs={programs} lang="en" />
      <Workshop lang="en" />
      <WatanTeaser lang="en" />
      <Territory lang="en" />
      <Testimonials lang="en" />
      <Pricing lang="en" />
      <Certificate lang="en" />
      <FAQ faqs={faqs} lang="en" />
      <SandStripe />
      <SiteFooter lang="en" />
      <WhatsAppFloat lang="en" />
    </>
  );
}
