import React, { useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { useVerifyEmail, useGetMe } from '@workspace/api-client-react';
import { useLocation, useSearch } from 'wouter';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import { getGetMeQueryKey } from '@workspace/api-client-react';

export default function VerifyEmail() {
  const { t } = useI18n();
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const token = new URLSearchParams(searchString).get('token');
  const queryClient = useQueryClient();
  const { data: user } = useGetMe();

  const verifyMutation = useVerifyEmail();

  useEffect(() => {
    if (token) {
      verifyMutation.mutate(
        { data: { token } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
          },
        }
      );
    }
  }, [token]); // Run once on mount if token exists

  const handleContinue = () => {
    if (user?.activeChild) {
      setLocation('/kid');
    } else if (user?.role === 'parent') {
      setLocation('/app');
    } else if (user?.role === 'admin' || user?.role === 'teacher') {
      setLocation('/admin');
    } else {
      setLocation('/login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4 py-12 font-sans">
      <div className="max-w-md w-full bg-card rounded-2xl shadow-xl border p-8 text-center animate-in fade-in zoom-in duration-300">
        {!token ? (
          <>
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t('رابط غير صالح', 'Invalid Link')}</h1>
            <p className="text-muted-foreground mb-8">
              {t('رابط التوثيق غير موجود أو غير صالح.', 'The verification link is missing or invalid.')}
            </p>
            <Button className="w-full" onClick={() => setLocation('/')}>{t('العودة للرئيسية', 'Back to Home')}</Button>
          </>
        ) : verifyMutation.isPending ? (
          <>
            <Loader2 className="w-16 h-16 text-primary mx-auto mb-4 animate-spin" />
            <h1 className="text-2xl font-bold mb-2">{t('جاري التوثيق...', 'Verifying...')}</h1>
            <p className="text-muted-foreground">
              {t('يرجى الانتظار بينما نقوم بتوثيق بريدك الإلكتروني.', 'Please wait while we verify your email.')}
            </p>
          </>
        ) : verifyMutation.isError ? (
          <>
            <XCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t('فشل التوثيق', 'Verification Failed')}</h1>
            <p className="text-muted-foreground mb-8">
              {t('قد يكون الرابط منتهي الصلاحية أو تم استخدامه بالفعل.', 'The link may have expired or has already been used.')}
            </p>
            <Button className="w-full" onClick={handleContinue}>{t('الاستمرار', 'Continue')}</Button>
          </>
        ) : verifyMutation.isSuccess ? (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold mb-2">{t('تم التوثيق بنجاح!', 'Verified Successfully!')}</h1>
            <p className="text-muted-foreground mb-8">
              {t('شكراً لك على توثيق بريدك الإلكتروني.', 'Thank you for verifying your email address.')}
            </p>
            <Button className="w-full" onClick={handleContinue}>{t('الاستمرار للوحة التحكم', 'Continue to Dashboard')}</Button>
          </>
        ) : null}
      </div>
    </div>
  );
}
