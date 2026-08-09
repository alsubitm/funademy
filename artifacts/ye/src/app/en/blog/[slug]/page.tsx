export const revalidate = 300;
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { BlogArticle } from '@/components/blog/BlogArticle';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) return {};
  return {
    title: `${post.titleEn || post.titleAr} | FunAdemy`,
    description: post.excerptEn || post.excerptAr,
  };
}

export default async function BlogPostPageEn(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) notFound();
  return <BlogArticle post={post} lang="en" />;
}
