import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetSubscription, useCancelSubscription } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, CreditCard, AlertTriangle, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { getGetSubscriptionQueryKey } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { format } from 'date-fns';

export default function Subscription() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: sub, isLoading } = useGetSubscription();
  const cancelMutation = useCancelSubscription();

  const handleCancel = () => {
    if (confirm(t('هل أنت متأكد من رغبتك في إلغاء الاشتراك؟ ستفقد الوصول لجميع المميزات في نهاية الفترة الحالية.', 'Are you sure you want to cancel? You will lose access to all features at the end of the current period.'))) {
      cancelMutation.mutate(undefined, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetSubscriptionQueryKey() });
          toast({ title: t('تم إلغاء الاشتراك', 'Subscription Cancelled') });
        }
      });
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500">{t('نشط', 'Active')}</Badge>;
      case 'trial':
        return <Badge className="bg-blue-500">{t('تجربة مجانية', 'Free Trial')}</Badge>;
      case 'past_due':
        return <Badge variant="destructive">{t('متأخر الدفع', 'Past Due')}</Badge>;
      case 'cancelled':
        return <Badge variant="secondary">{t('ملغى', 'Cancelled')}</Badge>;
      default:
        return <Badge variant="outline">{t('غير مشترك', 'None')}</Badge>;
    }
  };

  return (
    <div className="space-y-8 max-w-3xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('الاشتراك والفوترة', 'Subscription & Billing')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('إدارة خطة عائلتك وتفاصيل الدفع', 'Manage your family plan and payment details')}
        </p>
      </div>

      {isLoading ? (
        <Card className="animate-pulse h-64" />
      ) : (
        <Card className="border-primary/20 shadow-md">
          <CardHeader className="bg-muted/30 border-b">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-2xl mb-2 flex items-center gap-2">
                  {t('باقة العائلة المفتوحة', 'Unlimited Family Plan')}
                  {sub?.status && getStatusBadge(sub.status)}
                </CardTitle>
                <CardDescription>
                  {t('وصول كامل لجميع المناهج والمراحل لعدد غير محدود من الأبناء', 'Full access to all curricula and stages for unlimited children')}
                </CardDescription>
              </div>
              <div className="text-right rtl:text-left">
                {sub?.priceSar ? (
                  <>
                    <div className="text-3xl font-bold text-primary">{sub.priceSar}</div>
                    <div className="text-sm text-muted-foreground">{t('ريال', 'SAR')} / {t(sub.plan === 'annual' ? 'سنة' : 'شهر', sub.plan === 'annual' ? 'yr' : 'mo')}</div>
                  </>
                ) : (
                  <div className="text-xl font-bold text-muted-foreground">{t('لا يوجد اشتراك فعال', 'No active subscription')}</div>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            {sub?.status === 'trial' && sub.trialEndsAt && (
              <div className="bg-blue-50 dark:bg-blue-950/30 text-blue-800 dark:text-blue-300 p-4 rounded-lg flex items-start gap-3">
                <CalendarDays className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold">{t('أنت في فترة التجربة المجانية', 'You are on a free trial')}</h4>
                  <p className="text-sm mt-1">
                    {t('تنتهي في:', 'Ends on:')} {format(new Date(sub.trialEndsAt), 'PPP')}
                  </p>
                </div>
              </div>
            )}

            {sub?.currentPeriodEnd && sub.status !== 'trial' && (
              <div className="flex items-center gap-2 text-sm">
                <CalendarDays className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">{t('تاريخ التجديد القادم:', 'Next renewal date:')}</span>
                <span className="font-medium">{format(new Date(sub.currentPeriodEnd), 'PPP')}</span>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-4 mt-6">
              {['ملفات شخصية غير محدودة', 'تحديثات المنهج السعودي تلقائياً', 'بدون إعلانات مزعجة', 'تقارير أداء أسبوعية'].map((f, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-primary" />
                  <span className="text-sm">{f}</span>
                </div>
              ))}
            </div>
          </CardContent>
          <CardFooter className="bg-muted/10 border-t justify-between pt-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CreditCard className="w-4 h-4" />
              {t('الدفع آمن ومشفر', 'Payments are secure and encrypted')}
            </div>
            {sub?.status === 'active' || sub?.status === 'trial' ? (
              <Button variant="destructive" onClick={handleCancel} disabled={cancelMutation.isPending}>
                {t('إلغاء الاشتراك', 'Cancel Subscription')}
              </Button>
            ) : (
              <Button asChild>
                <Link href="/pricing">{t('ترقية الاشتراك', 'Upgrade Plan')}</Link>
              </Button>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
