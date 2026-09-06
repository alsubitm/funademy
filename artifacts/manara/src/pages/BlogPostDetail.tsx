import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetBlogPost, getGetBlogPostQueryKey } from '@workspace/api-client-react';
import { Link, useParams } from 'wouter';
import { ArrowLeft, ArrowRight, CalendarDays, Share2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

import { useSeo } from '@/hooks/use-seo';

export default function BlogPostDetail() {
  const { t, dir } = useI18n();
  const params = useParams();
  const slug = params.slug || '';
  
  const { data: post, isLoading } = useGetBlogPost(slug, { 
    query: { enabled: !!slug, queryKey: getGetBlogPostQueryKey(slug) } 
  });

  useSeo(
    post?.titleAr || 'مدونة منارة',
    post?.excerptAr || '',
    post?.titleAr || 'Manara Blog', // Fallback to Arabic if English title missing in schema
    post?.excerptAr || ''
  );
  
  const ArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  if (isLoading) {
    return (
      <div className="py-24 min-h-screen bg-background">
        <div className="container mx-auto px-4 max-w-3xl space-y-6">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-[300px] w-full rounded-[2rem]" />
          <Skeleton className="h-12 w-3/4" />
          <div className="space-y-4 pt-8">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="py-24 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{t('المقال غير موجود', 'Post not found')}</h1>
          <Button asChild>
            <Link href="/blog">{t('العودة للمدونة', 'Back to Blog')}</Link>
          </Button>
        </div>
      </div>
    );
  }

  // Split content by double newline to create paragraphs
  const paragraphs = post.contentAr.split('\n\n').filter(p => p.trim() !== '');

  return (
    <article className="py-16 md:py-24 min-h-screen bg-background">
      <div className="container mx-auto px-4 max-w-3xl">
        <Button variant="ghost" asChild className="mb-8 -ml-4 rtl:-mr-4 text-muted-foreground hover:text-foreground">
          <Link href="/blog">
            <ArrowIcon className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t('العودة للمدونة', 'Back to Blog')}
          </Link>
        </Button>

        <div className="mb-12">
          <div className="w-full aspect-[2/1] md:aspect-[3/1] bg-primary/5 rounded-[2rem] flex items-center justify-center text-[6rem] md:text-[8rem] mb-12 shadow-sm border border-border/50">
            {post.coverEmoji}
          </div>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
            <span className="flex items-center gap-2">
              <CalendarDays className="w-4 h-4" />
              {new Date(post.publishedAt).toLocaleDateString(dir === 'rtl' ? 'ar-SA' : 'en-US', {
                year: 'numeric', month: 'long', day: 'numeric'
              })}
            </span>
          </div>

          <h1 className="text-3xl md:text-5xl font-black text-foreground leading-tight mb-8">
            {post.titleAr}
          </h1>

          <div className="prose prose-lg dark:prose-invert prose-p:text-muted-foreground prose-p:leading-relaxed prose-headings:text-foreground max-w-none">
            {paragraphs.map((p, idx) => {
              // Basic bold text rendering: replace **text** with <strong>text</strong>
              // We'll do it safely via a simple component mapping
              const parts = p.split(/(\*\*.*?\*\*)/g);
              
              return (
                <p key={idx} className="mb-6 text-lg">
                  {parts.map((part, i) => {
                    if (part.startsWith('**') && part.endsWith('**')) {
                      return <strong key={i} className="font-bold text-foreground">{part.slice(2, -2)}</strong>;
                    }
                    return part;
                  })}
                </p>
              );
            })}
          </div>
        </div>

        <div className="pt-8 border-t flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="font-medium">{t('مشاركة المقال', 'Share this post')}</span>
            <Button variant="outline" size="icon" className="rounded-full" onClick={() => {
              navigator.clipboard.writeText(window.location.href);
            }}>
              <Share2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
