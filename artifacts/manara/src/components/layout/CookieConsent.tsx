import React, { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';

export function CookieConsent() {
  const { t } = useI18n();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('manara_cookie_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem('manara_cookie_consent', 'accepted');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 p-4 z-[100] animate-in slide-in-from-bottom-full duration-500">
      <div className="container mx-auto max-w-4xl">
        <div className="bg-card border border-border shadow-lg rounded-2xl p-4 md:p-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-bold text-lg mb-1">{t('نحن نستخدم ملفات تعريف الارتباط', 'We use cookies')}</h3>
            <p className="text-muted-foreground text-sm">
              {t(
                'نستخدم ملفات تعريف الارتباط الأساسية لضمان عمل المنصة بشكل صحيح (مثل تسجيل الدخول وحفظ لغتك المفضلة). نحن لا نستخدم ملفات تعريف الارتباط التتبعية للإعلانات.',
                'We use essential cookies to ensure the platform works correctly (such as login and your preferred language). We do not use tracking cookies for advertising.'
              )}{' '}
              <Link href="/privacy" className="text-primary hover:underline">
                {t('اقرأ سياسة الخصوصية', 'Read Privacy Policy')}
              </Link>
            </p>
          </div>
          <div className="flex shrink-0">
            <Button onClick={handleAccept} className="w-full md:w-auto">
              {t('أوافق', 'Accept')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
