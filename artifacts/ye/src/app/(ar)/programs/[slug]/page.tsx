export const revalidate = 300;
import { Metadata } from 'next';
import { prisma } from '@/lib/db';
import { safeQuery } from '@/lib/safe-query';
import { notFound } from 'next/navigation';
import { ProgramDetail } from './ProgramDetail';
import { siteUrl, ogImageUrl } from '@/lib/site-url';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const program = await safeQuery(() => prisma.program.findUnique({ where: { slug } }), null, 'program:metadata');
  if (!program) return {};
  const base = siteUrl();
  const ogImage = ogImageUrl(program.coverImageUrl);
  return {
    title: `${program.nameAr} - FunAdemy · e² Young Engineers`,
    description: program.taglineAr,
    alternates: {
      canonical: `${base}/programs/${slug}`,
      languages: {
        'x-default': `${base}/programs/${slug}`,
        'ar-SA': `${base}/programs/${slug}`,
        'en': `${base}/en/programs/${slug}`,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'ar_SA',
      title: `${program.nameAr} — FunAdemy`,
      description: program.taglineAr ?? undefined,
      images: [{ url: ogImage, width: 1200, height: 630, alt: program.nameAr }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@YEYoungEngineers',
      title: `${program.nameAr} — FunAdemy`,
      description: program.taglineAr ?? undefined,
      images: [ogImage],
    },
  };
}

export async function generateStaticParams() {
  // If the DB is unavailable/mismatched at build time, prebuild no pages;
  // they will render on demand at runtime instead of failing the publish.
  const programs = await safeQuery(() => prisma.program.findMany({ select: { slug: true } }), [], 'program:staticParams');
  return programs.map((p) => ({ slug: p.slug }));
}

export default async function ProgramPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const program = await safeQuery(() => prisma.program.findUnique({
    where: { slug },
    include: {
      slots: {
        where: { active: true },
        orderBy: [{ weekday: 'asc' }, { time: 'asc' }]
      }
    }
  }), null, 'program:page');

  if (!program) notFound();

  const allProgs = await safeQuery(() => prisma.program.findMany({ orderBy: { position: 'asc' } }), [], 'program:siblings');
  const idx = allProgs.findIndex(p => p.id === program.id);
  const prevProg = idx > 0 ? allProgs[idx - 1] : null;
  const nextProg = idx < allProgs.length - 1 ? allProgs[idx + 1] : null;

  const base = siteUrl();
  const programSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Course',
        '@id': `${base}/programs/${program.slug}`,
        name: program.nameAr,
        description: program.descAr,
        url: `${base}/programs/${program.slug}`,
        inLanguage: 'ar',
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
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: base },
          { '@type': 'ListItem', position: 2, name: 'البرامج', item: `${base}/#programs` },
          { '@type': 'ListItem', position: 3, name: program.nameAr, item: `${base}/programs/${program.slug}` },
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
      <ProgramDetail program={program} prevProg={prevProg} nextProg={nextProg} lang="ar" />
    </>
  );
}
