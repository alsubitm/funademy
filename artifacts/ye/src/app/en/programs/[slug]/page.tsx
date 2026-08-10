export const revalidate = 300;
import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { safeQuery } from '@/lib/safe-query';
import { notFound } from 'next/navigation';
import { ProgramDetail } from '@/app/programs/[slug]/ProgramDetail';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const program = await safeQuery(() => prisma.program.findUnique({ where: { slug } }), null, 'program-en:metadata');
  if (!program) return {};
  
  return {
    title: `${program.nameEn} - FunAdemy · e² Young Engineers`,
    description: program.taglineEn,
  };
}

export async function generateStaticParams() {
  // If the DB is unavailable/mismatched at build time, prebuild no pages;
  // they will render on demand at runtime instead of failing the publish.
  const programs = await safeQuery(() => prisma.program.findMany({ select: { slug: true } }), [], 'program-en:staticParams');
  return programs.map((p) => ({ slug: p.slug }));
}

export default async function ProgramPageEn(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const program = await safeQuery(() => prisma.program.findUnique({
    where: { slug },
    include: {
      slots: {
        where: { active: true },
        orderBy: [{ weekday: 'asc' }, { time: 'asc' }]
      }
    }
  }), null, 'program-en:page');

  if (!program) notFound();

  const allProgs = await safeQuery(() => prisma.program.findMany({ orderBy: { position: 'asc' } }), [], 'program-en:siblings');
  const idx = allProgs.findIndex(p => p.id === program.id);
  const prevProg = idx > 0 ? allProgs[idx - 1] : null;
  const nextProg = idx < allProgs.length - 1 ? allProgs[idx + 1] : null;

  return <ProgramDetail program={program} prevProg={prevProg} nextProg={nextProg} lang="en" />;
}