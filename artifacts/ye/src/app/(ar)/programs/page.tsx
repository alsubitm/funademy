export const revalidate = 300;
import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { safeQuery } from '@/lib/safe-query';
import { siteUrl } from '@/lib/site-url';
import { ProgramsListing } from '@/components/ProgramsListing';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  return {
    title: 'برامجنا المعتمدة | FunAdemy',
    description:
      'ثلاثة مجالات تعليمية وسبعة برامج معتمدة من e² Young Engineers للأعمار ٤–١٨. هندسة، برمجة، وروبوتات حضورياً في الرياض.',
    alternates: {
      canonical: `${base}/programs`,
      languages: {
        'x-default': `${base}/programs`,
        'ar-SA': `${base}/programs`,
        en: `${base}/en/programs`,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'ar_SA',
      title: 'برامجنا المعتمدة | FunAdemy',
      description:
        'ثلاثة مجالات تعليمية وسبعة برامج معتمدة من e² Young Engineers للأعمار ٤–١٨.',
      images: [{ url: `${base}/og-default.jpg`, width: 1200, height: 630, alt: 'FunAdemy Programs' }],
    },
  };
}

export default async function ProgramsPage() {
  const programs = await safeQuery(
    () => prisma.program.findMany({ orderBy: { position: 'asc' } }),
    [],
    'programs-listing:ar',
  );
  return <ProgramsListing programs={programs} lang="ar" />;
}
