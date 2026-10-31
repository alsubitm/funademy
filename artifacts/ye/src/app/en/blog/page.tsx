// Rendered at request time: build servers must not depend on DB state.
export const dynamic = 'force-dynamic';

import { Metadata } from 'next';
import { siteUrl } from '@/lib/site-url';
import { prisma, withDbRetry } from '@/lib/db';
import { safeQuery } from '@/lib/safe-query';
import { BlogList } from '@/components/blog/BlogList';

export function generateMetadata(): Metadata {
  const base = siteUrl();
  const ogImage = `${base}/og-default.jpg`;
  return {
    title: 'FunAdemy Blog | STEM & Engineering Tips for Kids in Riyadh',
    description: "Articles and tips for parents on STEM education and LEGO® engineering for kids in Riyadh. Activities and ideas to build your child's skills with FunAdemy.",
    alternates: {
      canonical: `${base}/en/blog`,
      languages: {
        'x-default': `${base}/blog`,
        'ar-SA': `${base}/blog`,
        'en-SA': `${base}/en/blog`,
      },
    },
    openGraph: {
      type: 'website',
      locale: 'en_SA',
      title: 'FunAdemy Blog | STEM & Engineering Tips for Kids in Riyadh',
      description: "Articles and tips for parents on STEM education and LEGO® engineering for kids in Riyadh.",
      images: [{ url: ogImage, width: 1200, height: 630, alt: 'FunAdemy Blog' }],
    },
    twitter: {
      card: 'summary_large_image',
      title: 'FunAdemy Blog | STEM & Engineering Tips for Kids in Riyadh',
      description: "Articles and tips for parents on STEM education and LEGO® engineering for kids in Riyadh.",
      images: [ogImage],
    },
  };
}

export default async function BlogPageEn() {
  const posts = await safeQuery(
    () => withDbRetry(
      () => prisma.blogPost.findMany({
        where: { published: true },
        orderBy: { publishedAt: 'desc' },
      }),
      { operation: 'blog-en:index', kind: 'read' },
    ),
    null,
    'blog-en:index',
  );
  return <BlogList posts={posts ?? []} lang="en" unavailable={posts === null} />;
}
