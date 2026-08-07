export const revalidate = 300;
import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { ProgramDetail } from './ProgramDetail';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const program = await prisma.program.findUnique({ where: { slug } });
  if (!program) return {};
  
  return {
    title: `${program.nameAr} - Young Engineers Riyadh`,
    description: program.taglineAr,
  };
}

export async function generateStaticParams() {
  const programs = await prisma.program.findMany({ select: { slug: true } });
  return programs.map((p) => ({ slug: p.slug }));
}

export default async function ProgramPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const program = await prisma.program.findUnique({
    where: { slug },
    include: {
      slots: {
        where: { active: true },
        orderBy: [{ weekday: 'asc' }, { time: 'asc' }]
      }
    }
  });

  if (!program) notFound();

  const allProgs = await prisma.program.findMany({ orderBy: { position: 'asc' } });
  const idx = allProgs.findIndex(p => p.id === program.id);
  const prevProg = idx > 0 ? allProgs[idx - 1] : null;
  const nextProg = idx < allProgs.length - 1 ? allProgs[idx + 1] : null;

  return <ProgramDetail program={program} prevProg={prevProg} nextProg={nextProg} lang="ar" />;
}