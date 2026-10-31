export const revalidate = 300;
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma, withDbRetry } from '@/lib/db';
import { safeQuery } from '@/lib/safe-query';
import { BlogArticle, BlogArticleUnavailable } from '@/components/blog/BlogArticle';
import { siteUrl, ogImageUrl } from '@/lib/site-url';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await safeQuery(
    () => withDbRetry(
      () => prisma.blogPost.findUnique({ where: { slug } }),
      { operation: 'blog-en:metadata', kind: 'read' },
    ),
    null,
    'blog-en:metadata',
  );
  if (!post || !post.published) return {};
  const base = siteUrl();
  const ogImage = ogImageUrl(post.coverImageUrl);
  const title = post.titleEn || post.titleAr;
  const description = post.excerptEn || post.excerptAr;
  return {
    title: `${title} | FunAdemy`,
    description,
    alternates: {
      canonical: `${base}/en/blog/${slug}`,
      languages: {
        'x-default': `${base}/blog/${slug}`,
        'ar-SA': `${base}/blog/${slug}`,
        'en-SA': `${base}/en/blog/${slug}`,
      },
    },
    openGraph: {
      type: 'article',
      locale: 'en_US',
      title,
      description: description ?? undefined,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@funademy',
      title,
      description: description ?? undefined,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPageEn(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const article = await safeQuery(
    () => withDbRetry(
      () => Promise.all([
        prisma.blogPost.findUnique({ where: { slug } }),
        prisma.blogPost.findMany({
          where: { published: true, slug: { not: slug } },
          orderBy: { publishedAt: 'desc' },
          take: 3,
          select: {
            slug: true,
            titleAr: true,
            titleEn: true,
            excerptAr: true,
            excerptEn: true,
            coverEmoji: true,
            publishedAt: true,
          },
        }),
      ]),
      { operation: 'blog-en:article', kind: 'read' },
    ),
    null,
    'blog-en:article',
  );
  if (!article) return <BlogArticleUnavailable lang="en" />;
  const [post, relatedPosts] = article;
  if (!post || !post.published) notFound();

  const base = siteUrl();
  const ogImage = ogImageUrl(post.coverImageUrl);
  const title = post.titleEn || post.titleAr;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${base}/en/blog/${post.slug}`,
        headline: title,
        image: ogImage,
        description: (post.excerptEn || post.excerptAr) ?? undefined,
        url: `${base}/en/blog/${post.slug}`,
        datePublished: post.publishedAt?.toISOString() ?? post.createdAt.toISOString(),
        dateModified: post.updatedAt?.toISOString() ?? post.createdAt.toISOString(),
        inLanguage: 'en',
        author: [
          {
            '@type': 'Person',
            name: 'FunAdemy Team',
            url: base,
          },
          {
            '@type': 'Organization',
            '@id': `${base}/#organization`,
            name: 'FunAdemy',
          },
        ],
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
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${base}/en` },
          { '@type': 'ListItem', position: 2, name: 'Blog', item: `${base}/en/blog` },
          { '@type': 'ListItem', position: 3, name: title, item: `${base}/en/blog/${post.slug}` },
        ],
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <BlogArticle post={post} lang="en" relatedPosts={relatedPosts} />
    </>
  );
}
