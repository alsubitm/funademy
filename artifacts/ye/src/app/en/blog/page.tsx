export const revalidate = 300;
import { prisma } from '@/lib/db';
import { BlogList } from '@/components/blog/BlogList';

export const metadata = {
  title: 'Blog | FunAdemy',
  description: 'Articles and tips for parents on learning through engineering, play, and building kids’ skills.',
};

export default async function BlogPageEn() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
  });
  return <BlogList posts={posts} lang="en" />;
}
