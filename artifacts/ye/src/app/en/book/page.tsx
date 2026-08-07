export const revalidate = 300;
import { prisma } from '@/lib/db';
import { SiteHeader } from '@/components/SiteHeader';
import { SiteFooter } from '@/components/SiteFooter';
import { SandStripe } from '@/components/SandStripe';
import { WhatsAppFloat } from '@/components/WhatsAppFloat';
import { BookingFlow } from '@/components/book/BookingFlow';
import { bookDict } from '@/app/book/dict';
import '@/app/book/page.css';

export const metadata = {
  title: 'Book a Trial | FunAdemy',
  description: 'Register your child for a free trial class to experience the Young Engineer journey.',
};

export default async function BookPageEn({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const sp = await searchParams;
  const programParam = typeof sp.program === 'string' ? sp.program : undefined;
  const programs = await prisma.program.findMany({ orderBy: { position: 'asc' } });
  const slots = await prisma.scheduleSlot.findMany({
    where: { active: true },
    orderBy: [{ weekday: 'asc' }, { time: 'asc' }],
  });

  const d = bookDict.en;

  return (
    <>
      <SiteHeader lang="en" />
      <SandStripe />
      
      <main className="book-pg">
        <div className="bpgrid light"></div>
        <div className="wrap" style={{ position: 'relative', paddingTop: '60px' }}>
          <div style={{ textAlign: 'center' }}>
            <span className="kick" style={{ color: 'var(--blue)', borderColor: 'var(--blue)' }}>TRIAL CLASS</span>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '32px' }}>{d.title}</h1>
            <p className="sub" style={{ margin: '8px auto 0' }}>{d.desc}</p>
          </div>

          <BookingFlow 
            programs={programs} 
            slots={slots} 
            lang="en" 
            preselectProgramSlug={programParam} 
          />
        </div>
      </main>

      <SandStripe />
      <SiteFooter lang="en" />
      <WhatsAppFloat lang="en" />
    </>
  );
}
