import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetAdminAnalytics } from '@workspace/api-client-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, CreditCard, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react';

export default function AdminDashboard() {
  const { t } = useI18n();
  const { data: analytics, isLoading } = useGetAdminAnalytics();

  if (isLoading) return <div className="p-8 animate-pulse grid grid-cols-4 gap-4"><div className="h-32 bg-muted rounded-xl col-span-4 md:col-span-1" /><div className="h-32 bg-muted rounded-xl col-span-4 md:col-span-1" /></div>;
  if (!analytics) return null;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Admin Overview</h1>
        <p className="text-muted-foreground mt-1">Platform metrics and health</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total MRR</CardTitle>
            <CreditCard className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono text-primary">SAR {analytics.mrrSar.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Active Subs</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.activeSubscriptions}</div>
            <p className="text-xs text-muted-foreground mt-1 flex items-center">
              + {analytics.trialingSubscriptions} on trial
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalParents} <span className="text-sm font-normal text-muted-foreground">Parents</span></div>
            <p className="text-xs text-muted-foreground mt-1">
              {analytics.totalChildren} Children Profiles
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-medium">Conversion / Churn</CardTitle>
            <Activity className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold flex items-center justify-between">
              <span className="text-green-600 flex items-center"><ArrowUpRight className="w-4 h-4" />{analytics.trialConversionRate}%</span>
              <span className="text-destructive flex items-center text-lg"><ArrowDownRight className="w-3 h-3" />{analytics.churnRate}%</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top Performing Lessons</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {analytics.lessonEngagement.map((lesson) => (
              <div key={lesson.lessonId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="font-medium">{lesson.titleAr} <span className="text-xs text-muted-foreground ml-2">ID: {lesson.lessonId}</span></div>
                <div className="flex gap-6 text-sm">
                  <span className="text-muted-foreground">{lesson.completions} completions</span>
                  <span className="font-bold text-primary">{lesson.averageScore}% avg score</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
