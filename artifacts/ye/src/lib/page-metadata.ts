import type { Metadata } from 'next';
import { ogImageUrl } from './site-url';

type PageMetadataInput = Omit<Metadata, 'title' | 'alternates'> & {
  title: string | { absolute: string };
  alternates: NonNullable<Metadata['alternates']> & { canonical: string };
};

/**
 * Next replaces nested social metadata rather than merging its fields.
 * Always emit a complete page identity, including Twitter when no custom
 * social copy was supplied. Search titles stay unbranded; layouts add it once.
 */
export function buildPageMetadata(input: PageMetadataInput, lang: 'ar' | 'en'): Metadata {
  return {
    ...input,
    ...buildSocialMetadata({
      canonical: input.alternates.canonical,
      title: typeof input.title === 'string' ? input.title : input.title.absolute,
      description: input.description,
      openGraph: input.openGraph,
    }, lang),
  };
}

export function buildSocialMetadata(
  input: {
    canonical: string;
    title: string;
    description?: string | null;
    openGraph?: Metadata['openGraph'];
  },
  lang: 'ar' | 'en',
): Pick<Metadata, 'openGraph' | 'twitter'> {
  const og = input.openGraph;
  const title = typeof og?.title === 'string' ? og.title : input.title;
  const description = og?.description ?? input.description ?? undefined;
  const sourceImages = og?.images
    ? (Array.isArray(og.images) ? og.images : [og.images])
    : [ogImageUrl(null)];
  const images = sourceImages.map((image) => {
    const details = typeof image === 'string' || image instanceof URL
      ? { url: image }
      : image;
    return {
      width: 1200,
      height: 630,
      alt: title,
      ...details,
      url: ogImageUrl(String(details.url)),
    };
  });

  return {
    openGraph: {
      type: 'website',
      ...og,
      url: input.canonical,
      siteName: 'FunAdemy',
      locale: lang === 'ar' ? 'ar_SA' : 'en_SA',
      title,
      description,
      images,
    },
    twitter: {
      card: 'summary_large_image',
      site: '@funademy',
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}
