// Rendered at request time: build servers must not depend on DB state.
export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';
import { prisma } from '@/lib/db';
import { BlogList } from '@/components/blog/BlogList';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  const ogImage = `${base}/og-default.jpg`;
  return {
    title: 'المدونة | FunAdemy',
    description: 'مقالات ونصائح للأهالي حول التعلم بالهندسة واللعب وتنمية مهارات الأطفال.',
    alternates: {
      canonical: `${base}/blog`,
      languages: {
        'x-default': `${base}/blog`,
        'ar-SA': `${base}/blog`,
        'en': `${base}/en/blog`,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'ar_SA',
      title: 'المدونة | FunAdemy',
      description: 'مقالات ونصائح للأهالي حول التعلم بالهندسة واللعب وتنمية مهارات الأطفال.',
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'FunAdemy Blog' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'المدونة | FunAdemy',
      description: 'مقالات ونصائح للأهالي حول التعلم بالهندسة واللعب وتنمية مهارات الأطفال.',
      images: [ogImage],
    },
  };
}

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
  });
  return <BlogList posts={posts} lang="ar" />;
}
