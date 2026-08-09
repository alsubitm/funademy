// Rendered at request time: build servers must not depend on DB state.
export const dynamic = 'force-dynamic';
import { prisma } from '@/lib/db';
import { BlogList } from '@/components/blog/BlogList';

export const metadata = {
  title: 'المدونة | FunAdemy',
  description: 'مقالات ونصائح للأهالي حول التعلم بالهندسة واللعب وتنمية مهارات الأطفال.',
};

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
  });
  return <BlogList posts={posts} lang="ar" />;
}
