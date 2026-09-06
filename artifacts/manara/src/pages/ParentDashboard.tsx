import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetParentOverview } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Link } from 'wouter';
import { Clock, BookCheck, TrendingUp, PlusCircle, ChevronLeft, ChevronRight } from 'lucide-react';

export default function ParentDashboard() {
  const { t, dir } = useI18n();
  const { data: overview, isLoading } = useGetParentOverview();
  
  const ChevronForward = dir === 'rtl' ? ChevronLeft : ChevronRight;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('نظرة عامة', 'Overview')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('تابع تقدم أبنائك الأسبوعي', 'Track your children\'s weekly progress')}
          </p>
        </div>
        <Button asChild>
          <Link href="/app/children">
            <PlusCircle className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t('إدارة الأبناء', 'Manage Children')}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map(i => (
            <Card key={i} className="animate-pulse">
              <CardHeader className="h-20 bg-muted rounded-t-xl" />
              <CardContent className="h-40" />
            </Card>
          ))}
        </div>
      ) : overview?.children.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 text-center border-dashed">
          <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
            <PlusCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <CardTitle className="mb-2">{t('لم يتم إضافة أبناء بعد', 'No children added yet')}</CardTitle>
          <p className="text-muted-foreground mb-6 max-w-md">
            {t('أضف ملفاً شخصياً لطفلك للبدء في رحلة التعلم المخصصة له.', 'Add a profile for your child to start their personalized learning journey.')}
          </p>
          <Button asChild>
            <Link href="/app/children">
              {t('إضافة طفل', 'Add Child')}
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {overview?.children.map((childCard) => (
            <Card key={childCard.child.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className={`h-2 w-full bg-primary`} />
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl shadow-inner border border-background">
                      {childCard.child.avatar || '👦'}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{childCard.child.name}</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        {t(
                          childCard.child.band === 'explorers' ? 'المستكشفون (4-7)' :
                          childCard.child.band === 'builders' ? 'البناة (8-11)' :
                          childCard.child.band === 'achievers' ? 'المنجزون (12-15)' : 'الخريجون (16-18)',
                          childCard.child.band === 'explorers' ? 'Explorers (4-7)' :
                          childCard.child.band === 'builders' ? 'Builders (8-11)' :
                          childCard.child.band === 'achievers' ? 'Achievers (12-15)' : 'Graduates (16-18)'
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-muted/50 p-3 rounded-lg flex flex-col">
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Clock className="w-3 h-3" /> {t('دقائق هذا الأسبوع', 'Mins this week')}
                      </span>
                      <span className="text-xl font-bold">{childCard.minutesThisWeek}</span>
                    </div>
                    <div className="bg-muted/50 p-3 rounded-lg flex flex-col">
                      <span className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <BookCheck className="w-3 h-3" /> {t('الدروس المنجزة', 'Lessons Done')}
                      </span>
                      <span className="text-xl font-bold">{childCard.lessonsCompletedThisWeek}</span>
                    </div>
                  </div>
                  
                  {childCard.averageScore !== null && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <TrendingUp className="w-4 h-4 text-primary" /> {t('متوسط التقييم', 'Avg Score')}
                      </span>
                      <span className="font-bold">{childCard.averageScore}%</span>
                    </div>
                  )}

                  {childCard.subjectsCovered.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {childCard.subjectsCovered.map((subject, idx) => (
                        <span key={idx} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-md">
                          {subject}
                        </span>
                      ))}
                    </div>
                  )}
                  
                  <Button variant="ghost" className="w-full mt-2 justify-between" asChild>
                    <Link href={`/app/children/${childCard.child.id}`}>
                      {t('عرض التقرير المفصل', 'View detailed report')}
                      <ChevronForward className="w-4 h-4" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
