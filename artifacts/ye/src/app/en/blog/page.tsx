// Rendered at request time: build servers must not depend on DB state.
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { BlogList } from '@/components/blog/BlogList';

const _siteUrl = `https://${(process.env.REPLIT_DOMAINS ?? '').split(',')[0] || 'funademy.sa'}`;
export const metadata = {
  title: 'Blog | FunAdemy',
  description: "Articles and tips for parents on learning through engineering, play, and building kids' skills.",
  openGraph: {
    type: 'website' as const,
    locale: 'en_US',
    title: 'Blog | FunAdemy',
    description: "Articles and tips for parents on learning through engineering, play, and building kids' skills.",
    images: [{ url: `${_siteUrl}/og-default.jpg`, width: 1200, height: 630, alt: 'FunAdemy Blog' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: 'Blog | FunAdemy',
    description: "Articles and tips for parents on learning through engineering, play, and building kids' skills.",
    images: [`${_siteUrl}/og-default.jpg`],
  },
};

export default async function BlogPageEn() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
  });
  return <BlogList posts={posts} lang="en" />;
}
