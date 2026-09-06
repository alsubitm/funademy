import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetChildReport, getGetChildReportQueryKey } from '@workspace/api-client-react';
import { useParams, Link } from 'wouter';
import { ArrowRight, ArrowLeft, Trophy, AlertCircle, CalendarDays, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function ChildReport() {
  const { t, dir, lang } = useI18n();
  const params = useParams();
  const id = parseInt(params.id || '0');
  
  const { data: report, isLoading } = useGetChildReport(id, { query: { enabled: !!id, queryKey: getGetChildReportQueryKey(id) } });
  
  const ArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  if (isLoading) return <div className="p-8 animate-pulse grid gap-8"><div className="h-32 bg-muted rounded-xl" /><div className="grid md:grid-cols-2 gap-8"><div className="h-64 bg-muted rounded-xl" /><div className="h-64 bg-muted rounded-xl" /></div></div>;
  if (!report) return null;

  const { child, strengths, struggles, weekActivity, recentLessons } = report;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/app/children">
            <ArrowIcon className="w-5 h-5" />
          </Link>
        </Button>
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center text-2xl shadow-inner border border-background">
          {child.avatar}
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('تقرير الأداء:', 'Performance Report:')} {child.name}</h1>
          <p className="text-muted-foreground mt-1">
            {t('تحليل تفصيلي لمستوى تقدم الطفل خلال الأسبوع', 'Detailed analysis of child\'s progress this week')}
          </p>
        </div>
      </div>

      {/* Activity Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            {t('النشاط الأسبوعي (بالدقائق)', 'Weekly Activity (Minutes)')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekActivity}>
                <XAxis dataKey="date" tickFormatter={(val) => new Date(val).toLocaleDateString(lang === 'ar' ? 'ar-SA' : 'en-US', { weekday: 'short' })} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                <Bar dataKey="minutes" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Strengths */}
        <Card className="border-green-500/20">
          <CardHeader className="bg-green-50/50 dark:bg-green-950/20 border-b">
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <Trophy className="w-5 h-5" />
              {t('نقاط القوة والإتقان', 'Strengths & Mastery')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {strengths.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t('لا توجد بيانات كافية هذا الأسبوع', 'Not enough data this week')}</p>
            ) : (
              <ul className="space-y-4">
                {strengths.map((item, idx) => (
                  <li key={idx} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">{lang === 'ar' ? item.topicAr : item.topicEn} <span className="text-muted-foreground font-normal">({item.subjectNameAr})</span></span>
                      <span className="text-green-600 font-bold">{item.averageScore}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full" style={{ width: `${item.averageScore}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Struggles */}
        <Card className="border-amber-500/20">
          <CardHeader className="bg-amber-50/50 dark:bg-amber-950/20 border-b">
            <CardTitle className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertCircle className="w-5 h-5" />
              {t('مواضيع تحتاج اهتماماً', 'Needs Attention')}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            {struggles.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">{t('رائع! لم نواجه صعوبات ملموسة هذا الأسبوع', 'Great! No major struggles this week')}</p>
            ) : (
              <ul className="space-y-4">
                {struggles.map((item, idx) => (
                  <li key={idx} className="flex flex-col gap-1">
                    <div className="flex justify-between text-sm">
                      <span className="font-bold">{lang === 'ar' ? item.topicAr : item.topicEn} <span className="text-muted-foreground font-normal">({item.subjectNameAr})</span></span>
                      <span className="text-amber-600 font-bold">{item.averageScore}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${item.averageScore}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Lessons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            {t('الدروس المنجزة مؤخراً', 'Recently Completed Lessons')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentLessons.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t('لم يتم إنجاز دروس مؤخراً', 'No recent lessons completed')}</p>
          ) : (
            <div className="space-y-4">
              {recentLessons.map((lesson) => (
                <div key={lesson.id} className="flex items-center justify-between p-4 bg-muted/30 rounded-lg border border-border/50">
                  <div>
                    <h4 className="font-bold">{lang === 'ar' ? lesson.titleAr : lesson.titleEn}</h4>
                    <p className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
                      <span>⏱️ {lesson.durationMinutes} {t('دقيقة', 'mins')}</span>
                    </p>
                  </div>
                  <div className="text-lg font-bold text-primary">
                    {lesson.score !== null ? `${lesson.score}%` : '✅'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
