export const revalidate = 60;
import { getProgramDetail, getProgramSiblings } from '@/lib/program-detail-data';
import { loadProgramPricing } from '@/lib/program-pricing';
import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { safeQuery } from '@/lib/safe-query';
import { withTrialSeats } from '@/lib/trial-capacity';
import { notFound } from 'next/navigation';
import { siteUrl, ogImageUrl } from '@/lib/site-url';
import { buildPageMetadata } from '@/lib/page-metadata';
import { ProgramDetail } from '@/app/(ar)/programs/[slug]/ProgramDetail';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const program = await getProgramDetail(slug);
  if (!program) return {};
  const base = siteUrl();
  const ogImage = ogImageUrl(program.coverImageUrl);
  return buildPageMetadata({
    title: program.nameEn,
    description: program.taglineEn,
    alternates: {
      canonical: `${base}/en/programs/${slug}`,
      languages: {
        'x-default': `${base}/programs/${slug}`,
        'ar-SA': `${base}/programs/${slug}`,
        'en-SA': `${base}/en/programs/${slug}`,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      title: `${program.nameEn} — FunAdemy`,
      description: program.taglineEn ?? undefined,
      images: [{ url: ogImage, width: 1200, height: 630, alt: program.nameEn }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@funademy',
      title: `${program.nameEn} — FunAdemy`,
      description: program.taglineEn ?? undefined,
      images: [ogImage],
    },
  }, 'en');
}

export async function generateStaticParams() {
  // If the DB is unavailable/mismatched at build time, prebuild no pages;
  // they will render on demand at runtime instead of failing the publish.
  const programs = await safeQuery(() => prisma.program.findMany({ select: { slug: true } }), [], 'program-en:staticParams');
  return programs.map((p) => ({ slug: p.slug }));
}

export default async function ProgramPageEn(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const stored = await getProgramDetail(slug);

  if (!stored) notFound();
  const program = { ...stored };
  const [slots, pricingRuns, allProgs] = await Promise.all([
    safeQuery(() => withTrialSeats(program.slots), program.slots, 'program:trialSeats'),
    loadProgramPricing(program.id),
    getProgramSiblings(),
  ]);
  program.slots = slots;
  const idx = allProgs.findIndex(p => p.id === program.id);
  const prevProg = idx > 0 ? allProgs[idx - 1] : null;
  const nextProg = idx < allProgs.length - 1 ? allProgs[idx + 1] : null;

  const base = siteUrl();
  const programSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        '@id': `${base}/en/programs/${program.slug}`,
        name: program.nameEn,
        description: program.descEn,
        url: `${base}/en/programs/${program.slug}`,
        inLanguage: 'en',
        provider: {
          '@type': 'Organization',
          '@id': `${base}/#organization`,
          name: 'FunAdemy',
          url: base,
        },
        audience: {
          '@type': 'EducationalAudience',
          educationalRole: 'student',
          suggestedMinAge: program.ageMin,
          suggestedMaxAge: program.ageMax,
        },
        courseMode: program.format === 'online' ? 'online' : 'onsite',
        educationalCredentialAwarded: 'Certificate of Completion',
        hasCourseInstance: program.slots.map(slot => ({
          '@type': 'CourseInstance',
          courseMode: slot.format === 'online' ? 'online' : 'onsite',
          ...(slot.location ? {
            location: {
              '@type': 'Place',
              name: slot.location,
              address: {
                '@type': 'PostalAddress',
                addressLocality: 'Riyadh',
                addressCountry: 'SA',
              },
            },
          } : {}),
          courseSchedule: {
            '@type': 'Schedule',
            byDay: `https://schema.org/${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][slot.weekday]}`,
            startTime: slot.time,
          },
          offers: {
            '@type': 'Offer',
            availability: (slot.seatsLeft ?? 1) > 0
              ? 'https://schema.org/InStock'
              : 'https://schema.org/SoldOut',
            priceCurrency: 'SAR',
            seller: { '@id': `${base}/#organization` },
          },
        })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/en` },
          { '@type': 'ListItem', position: 2, name: program.nameEn, item: `${base}/en/programs/${program.slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(programSchema) }}
      />
      <ProgramDetail program={program} pricingRuns={pricingRuns} prevProg={prevProg} nextProg={nextProg} lang="en" />
    </>
  );
}
