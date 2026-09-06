import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetMe, useRequestDataDeletion } from '@workspace/api-client-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';

export default function Settings() {
  const { t } = useI18n();
  const { data: user } = useGetMe();
  const { toast } = useToast();
  const deletionMutation = useRequestDataDeletion();
  const [reason, setReason] = React.useState('');

  const handleDeleteRequest = () => {
    if (confirm(t('هل أنت متأكد من تقديم طلب حذف لجميع بياناتك؟ سيتم تدمير جميع بيانات العائلة بشكل نهائي.', 'Are you sure you want to request data deletion? All family data will be permanently destroyed.'))) {
      deletionMutation.mutate({ data: { reason } }, {
        onSuccess: () => {
          toast({ title: t('تم استلام الطلب', 'Request received'), description: t('سيتم معالجة طلبك خلال 48 ساعة', 'Your request will be processed within 48 hours') });
          setReason('');
        }
      });
    }
  };

  return (
    <div className="space-y-8 max-w-2xl animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{t('الإعدادات', 'Settings')}</h1>
        <p className="text-muted-foreground mt-1">
          {t('إدارة حسابك الشخصي والخصوصية', 'Manage your personal account and privacy')}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('بيانات الحساب', 'Account Details')}</CardTitle>
          <CardDescription>{t('المعلومات الأساسية لولي الأمر', 'Basic parent information')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{t('الاسم', 'Name')}</Label>
            <Input value={user?.name || ''} readOnly className="bg-muted/50" />
          </div>
          <div className="grid gap-2">
            <Label>{t('البريد الإلكتروني', 'Email')}</Label>
            <Input value={user?.email || ''} readOnly className="bg-muted/50" dir="ltr" />
          </div>
          {/* Note: In a real app we'd have a change password / update profile form here */}
          <Button variant="outline" className="mt-2" disabled>{t('تحديث البيانات', 'Update Profile')}</Button>
        </CardContent>
      </Card>

      <Card className="border-destructive/20">
        <CardHeader>
          <CardTitle className="text-destructive">{t('حذف الحساب', 'Delete Account')}</CardTitle>
          <CardDescription>
            {t('طلب حذف جميع بيانات العائلة والأطفال من خوادمنا بشكل نهائي. هذا الإجراء لا يمكن التراجع عنه.', 'Request permanent deletion of all family and child data from our servers. This action cannot be undone.')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label>{t('سبب الحذف (اختياري)', 'Reason (Optional)')}</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder={t('أخبرنا عن سبب مغادرتك لتحسين خدماتنا', 'Tell us why you are leaving to help us improve')} />
          </div>
          <Button variant="destructive" onClick={handleDeleteRequest} disabled={deletionMutation.isPending}>
            {t('طلب حذف البيانات نهائياً', 'Request Permanent Deletion')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
