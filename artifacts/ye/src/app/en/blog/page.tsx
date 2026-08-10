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
    title: 'Blog | FunAdemy',
    description: "Articles and tips for parents on learning through engineering, play, and building kids' skills.",
    alternates: {
      canonical: `${base}/en/blog`,
      languages: {
        'x-default': `${base}/blog`,
        'ar-SA': `${base}/blog`,
        'en': `${base}/en/blog`,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'en_US',
      title: 'Blog | FunAdemy',
      description: "Articles and tips for parents on learning through engineering, play, and building kids' skills.",
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'FunAdemy Blog' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'Blog | FunAdemy',
      description: "Articles and tips for parents on learning through engineering, play, and building kids' skills.",
      images: [ogImage],
    },
  };
}

export default async function BlogPageEn() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
  });
  return <BlogList posts={posts} lang="en" />;
}
