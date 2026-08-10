export const revalidate = 300;
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { BlogArticle } from '@/components/blog/BlogArticle';
import { siteUrl } from '@/lib/site-url';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) return {};
  return {
    title: `${post.titleAr} | FunAdemy`,
    description: post.excerptAr,
  };
}

export default async function BlogPostPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) notFound();

  const base = siteUrl();
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${base}/blog/${post.slug}`,
    headline: post.titleAr,
    description: post.excerptAr ?? undefined,
    url: `${base}/blog/${post.slug}`,
    datePublished: post.publishedAt?.toISOString() ?? post.createdAt.toISOString(),
    dateModified: post.updatedAt?.toISOString() ?? post.createdAt.toISOString(),
    inLanguage: 'ar',
    author: {
      '@type': 'Organization',
      '@id': `${base}/#organization`,
      name: 'FunAdemy',
      url: base,
    },
    publisher: {
      '@type': 'Organization',
      '@id': `${base}/#organization`,
      name: 'FunAdemy',
      logo: {
        '@type': 'ImageObject',
        url: `${base}/brand/ye-logo.svg`,
      },
    },
    isPartOf: { '@id': `${base}/#website` },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <BlogArticle post={post} lang="ar" />
    </>
  );
}
