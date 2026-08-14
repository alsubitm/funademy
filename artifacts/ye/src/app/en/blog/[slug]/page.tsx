export const revalidate = 300;
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import { BlogArticle } from '@/components/blog/BlogArticle';
import { siteUrl, ogImageUrl } from '@/lib/site-url';

export async function generateMetadata(props: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
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
        'en': `${base}/en/blog/${slug}`,
      },
    },
    openGraph: {
      type: 'article',
      locale: 'en_US',
      title,
      description: description ?? undefined,
      publishedTime: post.publishedAt?.toISOString(),
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      site: '@YEYoungEngineers',
      title,
      description: description ?? undefined,
      images: [ogImage],
    },
  };
}

export default async function BlogPostPageEn(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const post = await prisma.blogPost.findUnique({ where: { slug } });
  if (!post || !post.published) notFound();

  const base = siteUrl();
  const title = post.titleEn || post.titleAr;
  const articleSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': `${base}/en/blog/${post.slug}`,
        headline: title,
        description: (post.excerptEn || post.excerptAr) ?? undefined,
        url: `${base}/en/blog/${post.slug}`,
        datePublished: post.publishedAt?.toISOString() ?? post.createdAt.toISOString(),
        dateModified: post.updatedAt?.toISOString() ?? post.createdAt.toISOString(),
        inLanguage: 'en',
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
      <BlogArticle post={post} lang="en" />
    </>
  );
}
