/**
 * BlogArticle cover-image rendering guard.
 *
 * Verifies that BlogArticle renders:
 * - A plain <img> with the correct src when coverImageUrl is a valid external
 *   HTTPS URL (e.g. https://cdn.example.com/photo.jpg).
 * - A plain <img> with the correct src when coverImageUrl is a root-relative
 *   path (e.g. /uploads/cover.jpg).
 * - The emoji fallback div when coverImageUrl is null (no image URL set).
 *
 * A plain <img> element is used intentionally — next/image requires
 * remotePatterns for every external hostname, making it unsuitable for
 * user-supplied cover URLs of arbitrary origin. The plain element works for
 * all origins without server-side optimisation config.
 */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// ── Mock Next.js and heavy component dependencies ──────────────────────────

vi.mock('next/link', () => ({
  default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
    React.createElement('a', { href, className }, children),
}));

vi.mock('@/components/SiteHeader', () => ({
  SiteHeader: () => null,
}));

vi.mock('@/components/SiteFooter', () => ({
  SiteFooter: () => null,
}));

vi.mock('@/components/SandStripe', () => ({
  SandStripe: () => null,
}));

vi.mock('@/components/WhatsAppFloat', () => ({
  WhatsAppFloat: () => null,
}));

// blog.css is a side-effect import; mock it so vitest doesn't fail on CSS
vi.mock('@/components/blog/blog.css', () => ({}));

// ── Import component under test ────────────────────────────────────────────

import { BlogArticle } from '@/components/blog/BlogArticle';

// ── Shared post fixture ────────────────────────────────────────────────────

const BASE_POST = {
  slug: 'test-post',
  titleAr: 'مقال تجريبي',
  titleEn: 'Test Article',
  contentAr: 'محتوى عربي.',
  contentEn: 'English content.',
  coverEmoji: '🚀',
  publishedAt: new Date('2026-01-15'),
};

// ── Tests ──────────────────────────────────────────────────────────────────

describe('BlogArticle cover image rendering', () => {
  it('renders a plain <img> with the external HTTPS cover URL', () => {
    const post = { ...BASE_POST, coverImageUrl: 'https://cdn.example.com/covers/stem-lego.jpg' };
    const html = renderToStaticMarkup(React.createElement(BlogArticle, { post, lang: 'ar' }));

    expect(html).toContain('<img');
    expect(html).toContain('src="https://cdn.example.com/covers/stem-lego.jpg"');
    // Emoji fallback must NOT appear when a cover image is present
    expect(html).not.toContain('b-emoji');
  });

  it('renders a plain <img> with a root-relative cover URL', () => {
    const post = { ...BASE_POST, coverImageUrl: '/uploads/covers/stem-lego.jpg' };
    const html = renderToStaticMarkup(React.createElement(BlogArticle, { post, lang: 'ar' }));

    expect(html).toContain('<img');
    expect(html).toContain('src="/uploads/covers/stem-lego.jpg"');
    expect(html).not.toContain('b-emoji');
  });

  it('uses the post title as the img alt attribute', () => {
    const post = { ...BASE_POST, coverImageUrl: 'https://cdn.example.com/photo.jpg' };
    const html = renderToStaticMarkup(React.createElement(BlogArticle, { post, lang: 'ar' }));
    // Arabic lang → titleAr is the rendered title
    expect(html).toContain('alt="مقال تجريبي"');
  });

  it('uses the English title as alt when lang=en and titleEn is set', () => {
    const post = { ...BASE_POST, coverImageUrl: 'https://cdn.example.com/photo.jpg' };
    const html = renderToStaticMarkup(React.createElement(BlogArticle, { post, lang: 'en' }));
    expect(html).toContain('alt="Test Article"');
  });

  it('renders the emoji fallback div when coverImageUrl is null', () => {
    const post = { ...BASE_POST, coverImageUrl: null };
    const html = renderToStaticMarkup(React.createElement(BlogArticle, { post, lang: 'ar' }));

    expect(html).toContain('b-emoji');
    expect(html).toContain('🚀');
    expect(html).not.toContain('<img');
  });
});
