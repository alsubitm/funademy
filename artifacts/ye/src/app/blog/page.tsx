// Rendered at request time: build servers must not depend on DB state.
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { BlogList } from '@/components/blog/BlogList';

const _siteUrl = `https://${(process.env.REPLIT_DOMAINS ?? '').split(',')[0] || 'funademy.sa'}`;
export const metadata = {
  title: 'المدونة | FunAdemy',
  description: 'مقالات ونصائح للأهالي حول التعلم بالهندسة واللعب وتنمية مهارات الأطفال.',
  openGraph: {
    type: 'website' as const,
    locale: 'ar_SA',
    title: 'المدونة | FunAdemy',
    description: 'مقالات ونصائح للأهالي حول التعلم بالهندسة واللعب وتنمية مهارات الأطفال.',
    images: [{ url: `${_siteUrl}/og-default.jpg`, width: 1200, height: 630, alt: 'FunAdemy Blog' }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    title: 'المدونة | FunAdemy',
    description: 'مقالات ونصائح للأهالي حول التعلم بالهندسة واللعب وتنمية مهارات الأطفال.',
    images: [`${_siteUrl}/og-default.jpg`],
  },
};

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
  });
  return <BlogList posts={posts} lang="ar" />;
}
