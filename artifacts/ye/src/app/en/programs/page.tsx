export const revalidate = 300;
import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { safeQuery } from '@/lib/safe-query';
import { siteUrl } from '@/lib/site-url';
import { ProgramsListing } from '@/components/ProgramsListing';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  return {
    title: 'Our Programs | FunAdemy · e² Young Engineers',
    description:
      'Three educational fields, seven e² Young Engineers certified programs for ages 4–18. Engineering, coding, and robotics online in Riyadh.',
    alternates: {
      canonical: `${base}/en/programs`,
      languages: {
        'x-default': `${base}/programs`,
        'ar-SA': `${base}/programs`,
        en: `${base}/en/programs`,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      title: 'Our Programs | FunAdemy',
      description:
        'Three educational fields, seven e² Young Engineers certified programs for ages 4–18.',
      images: [{ url: `${base}/og-default.jpg`, width: 1200, height: 630, alt: 'FunAdemy Programs' }],
    },
  };
}

export default async function ProgramsPageEn() {
  const programs = await safeQuery(
    () => prisma.program.findMany({ orderBy: { position: 'asc' } }),
    [],
    'programs-listing:en',
  );
  return <ProgramsListing programs={programs} lang="en" />;
}
