import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useListBlogPosts } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { ArrowLeft, ArrowRight, CalendarDays, BookOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function Blog() {
  const { t, dir } = useI18n();
  const { data: posts, isLoading } = useListBlogPosts();
  
  const ArrowIcon = dir === 'rtl' ? ArrowLeft : ArrowRight;

  return (
    <div className="py-24 min-h-screen bg-muted/20">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16">
          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center text-primary mx-auto mb-6">
            <BookOpen className="w-8 h-8" />
          </div>
          <h1 className="text-4xl font-extrabold mb-4 text-foreground">{t('مدونة منارة', 'Manara Blog')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('نصائح للآباء، تحديثات المنصة، ومقالات حول تعليم وتربية الأطفال.', 'Tips for parents, platform updates, and articles on education and parenting.')}
          </p>
        </div>

        {isLoading ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1, 2, 3].map(i => (
              <Card key={i} className="animate-pulse">
                <div className="h-48 bg-muted rounded-t-xl" />
                <CardHeader className="h-24" />
                <CardContent className="h-20" />
              </Card>
            ))}
          </div>
        ) : posts?.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-border rounded-2xl">
            {t('لا توجد مقالات بعد', 'No posts yet')}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts?.map(post => (
              <Card key={post.id} className="flex flex-col h-full overflow-hidden hover:shadow-lg transition-all duration-300 border-border/50 group">
                <div className="h-48 bg-primary/5 flex items-center justify-center text-6xl group-hover:scale-105 transition-transform duration-500">
                  {post.coverEmoji || '📝'}
                </div>
                <CardHeader className="flex-1">
                  <div className="flex items-center text-sm text-muted-foreground mb-3 gap-2">
                    <CalendarDays className="w-4 h-4" />
                    {new Date(post.publishedAt).toLocaleDateString(dir === 'rtl' ? 'ar-SA' : 'en-US', {
                      year: 'numeric', month: 'long', day: 'numeric'
                    })}
                  </div>
                  <CardTitle className="text-xl leading-tight line-clamp-2">
                    {post.titleAr}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground line-clamp-3 text-sm leading-relaxed">
                    {post.excerptAr}
                  </p>
                </CardContent>
                <CardFooter className="pt-0 border-t border-border/50 mt-auto">
                  <Button variant="ghost" className="w-full mt-4 justify-between group/btn text-primary hover:text-primary hover:bg-primary/5" asChild>
                    <Link href={`/blog/${post.slug}`}>
                      {t('اقرأ المزيد', 'Read more')}
                      <ArrowIcon className="w-4 h-4 group-hover/btn:translate-x-1 rtl:group-hover/btn:-translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
