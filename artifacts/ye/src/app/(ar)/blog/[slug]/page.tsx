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
      { operation: 'blog-ar:metadata', kind: 'read' },
    ),
    null,
    'blog-ar:metadata',
  );
  if (!post || !post.published) return {};
  const base = siteUrl();
  const ogImage = ogImageUrl(post.coverImageUrl);
  return {
    title: post.titleAr,
    description: post.excerptAr,
    alternates: {
      canonical: `${base}/blog/${slug}`,
      languages: {
        'x-default': `${base}/blog/${slug}`,
        'ar-SA': `${base}/blog/${slug}`,
        'en-SA': `${base}/en/blog/${slug}`,
      },
    },
    openGraph: {
      type: 'article',
      locale: 'ar_SA',
      title: post.titleAr,
      description: post.excerptAr ?? undefined,
      publishedTime: post.publishedAt?.toISOString(),
      modifiedTime: post.updatedAt?.toISOString(),
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.titleAr }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@funademy',
      title: post.titleAr,
      description: post.excerptAr ?? undefined,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPage(props: { params: Promise<{ slug: string }> }) {
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
      { operation: 'blog-ar:article', kind: 'read' },
    ),
    null,
    'blog-ar:article',
  );
  if (!article) return <BlogArticleUnavailable lang="ar" />;
  const [post, relatedPosts] = article;
  if (!post || !post.published) notFound();

  const base = siteUrl();
  const ogImage = ogImageUrl(post.coverImageUrl);
  const articleSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${base}/blog/${post.slug}`,
        headline: post.titleAr,
        image: ogImage,
        description: post.excerptAr ?? undefined,
        url: `${base}/blog/${post.slug}`,
        datePublished: post.publishedAt?.toISOString() ?? post.createdAt.toISOString(),
        dateModified: post.updatedAt?.toISOString() ?? post.createdAt.toISOString(),
        inLanguage: 'ar',
        author: [
          {
            '@type': 'Person',
            name: 'فريق فناديمي',
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
          { '@type': 'ListItem', position: 1, name: 'الرئيسية', item: base },
          { '@type': 'ListItem', position: 2, name: 'المدونة', item: `${base}/blog` },
          { '@type': 'ListItem', position: 3, name: post.titleAr, item: `${base}/blog/${post.slug}` },
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
      <BlogArticle post={post} lang="ar" relatedPosts={relatedPosts} />
    </>
  );
}
