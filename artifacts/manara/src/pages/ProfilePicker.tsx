import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useListChildren, useSelectChild } from '@workspace/api-client-react';
import { Link, useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { ArrowRight, ArrowLeft, LockKeyhole } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

export default function ProfilePicker() {
  const { t, dir } = useI18n();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: children, isLoading } = useListChildren();
  const selectMutation = useSelectChild();

  const [selectedChildId, setSelectedChildId] = useState<number | null>(null);
  const [pin, setPin] = useState('');

  const ArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedChildId || pin.length !== 4) return;

    selectMutation.mutate({ id: selectedChildId, data: { pin } }, {
      onSuccess: () => {
        setLocation('/kid');
      },
      onError: () => {
        toast({ title: t('الرمز غير صحيح', 'Incorrect PIN'), variant: 'destructive' });
        setPin('');
      }
    });
  };

  const selectedChild = children?.find(c => c.id === selectedChildId);

  if (selectedChildId && selectedChild) {
    return (
      <div className={`min-h-screen flex flex-col items-center justify-center bg-background theme-${selectedChild.band}`}>
        <div className="absolute top-8 start-8">
          <Button variant="ghost" size="icon" onClick={() => { setSelectedChildId(null); setPin(''); }}>
            <ArrowIcon className="w-6 h-6 text-muted-foreground hover:text-foreground" />
          </Button>
        </div>
        
        <div className="text-center mb-8 animate-in slide-in-from-bottom-4">
          <div className="w-32 h-32 mx-auto rounded-full bg-primary flex items-center justify-center text-6xl shadow-xl mb-6">
            {selectedChild.avatar}
          </div>
          <h2 className="text-3xl font-black text-foreground">{t('مرحباً', 'Welcome')} {selectedChild.name}!</h2>
          <p className="text-muted-foreground mt-2">{t('أدخل الرمز السري الخاص بك', 'Enter your secret code')}</p>
        </div>

        <form onSubmit={handlePinSubmit} className="flex flex-col items-center gap-6 animate-in slide-in-from-bottom-8">
          <div className="flex items-center justify-center bg-card rounded-2xl shadow-sm border p-4">
            <LockKeyhole className="w-6 h-6 text-muted-foreground mr-4 rtl:ml-4 rtl:mr-0" />
            <Input 
              type="password" 
              inputMode="numeric"
              pattern="\d*"
              maxLength={4}
              value={pin}
              onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0,4))}
              className="text-4xl text-center tracking-[1em] border-0 focus-visible:ring-0 w-48 bg-transparent"
              placeholder="••••"
              autoFocus
              dir="ltr"
            />
          </div>
          <Button 
            type="submit" 
            size="lg" 
            className="w-full h-14 text-xl rounded-xl"
            disabled={pin.length !== 4 || selectMutation.isPending}
          >
            {t('انطلق!', 'Let\'s Go!')}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background/50 p-8">
      <div className="flex items-center justify-between mb-12">
        <Button variant="ghost" asChild>
          <Link href="/app">
            <ArrowIcon className="w-5 h-5 mr-2 rtl:ml-2 rtl:mr-0" />
            {t('العودة للوحة تحكم الآباء', 'Back to Parent Dashboard')}
          </Link>
        </Button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center max-w-4xl mx-auto w-full">
        <h1 className="text-4xl font-black text-foreground mb-12 text-center">
          {t('من أنت اليوم؟', 'Who is learning today?')}
        </h1>

        {isLoading ? (
          <div className="flex gap-8 justify-center">
            {[1, 2].map(i => <div key={i} className="w-32 h-32 rounded-full bg-muted animate-pulse" />)}
          </div>
        ) : (
          <div className="flex flex-wrap justify-center gap-8 md:gap-12">
            {children?.map((child) => (
              <button
                key={child.id}
                onClick={() => setSelectedChildId(child.id)}
                className="flex flex-col items-center gap-4 group"
              >
                <div className={`w-32 h-32 md:w-40 md:h-40 rounded-[2rem] bg-card border-4 border-transparent flex items-center justify-center text-6xl shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:-translate-y-2 theme-${child.band} group-hover:border-primary group-hover:shadow-xl`}>
                  {child.avatar}
                </div>
                <span className="text-xl font-bold text-foreground group-hover:text-primary transition-colors">
                  {child.name}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
