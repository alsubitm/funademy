// Rendered at request time: build servers must not depend on DB state.
export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';
import { getBlogIndex } from '@/lib/blog-index';
import { buildPageMetadata } from '@/lib/page-metadata';
import { safeQuery } from '@/lib/safe-query';
import { BlogList } from '@/components/blog/BlogList';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  const ogImage = `${base}/og-default.jpg`;
  return buildPageMetadata({
    title: 'المدونة | تعليم STEM وهندسة الأطفال بالرياض',
    description: 'مقالات ونصائح للأهالي حول تعليم STEM وهندسة الأطفال بالليغو® في الرياض. أفكار وأنشطة لتنمية مهارات أطفالك مع FunAdemy.',
    alternates: {
      canonical: `${base}/blog`,
      languages: {
        'x-default': `${base}/blog`,
        'ar-SA': `${base}/blog`,
        'en-SA': `${base}/en/blog`,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'ar_SA',
      title: 'مدونة فناديمي | تعليم STEM وهندسة الأطفال بالرياض',
      description: 'مقالات ونصائح للأهالي حول تعليم STEM وهندسة الأطفال بالليغو® في الرياض.',
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'FunAdemy Blog' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'مدونة فناديمي | تعليم STEM وهندسة الأطفال بالرياض',
      description: 'مقالات ونصائح للأهالي حول تعليم STEM وهندسة الأطفال بالليغو® في الرياض.',
      images: [ogImage],
    },
  }, 'ar');
}

export default async function BlogPage() {
  const posts = await safeQuery(
    getBlogIndex,
    null,
    'blog-ar:index',
  );
  return <BlogList posts={posts ?? []} lang="ar" unavailable={posts === null} />;
}
