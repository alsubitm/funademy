import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useVerifyParentGate, logout } from '@workspace/api-client-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { LockKeyhole, UserX } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export function ParentGate({ children, onVerified }: { children: React.ReactNode, onVerified: () => void }) {
  const { t, dir } = useI18n();
  const { toast } = useToast();
  const verifyMutation = useVerifyParentGate();
  const [pin, setPin] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== 4) return;

    verifyMutation.mutate({ data: { pin } }, {
      onSuccess: () => {
        setIsOpen(false);
        setPin('');
        onVerified();
      },
      onError: () => {
        toast({ title: t('الرمز غير صحيح', 'Incorrect PIN'), variant: 'destructive' });
        setPin('');
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => {
      setIsOpen(open);
      if (!open) setPin('');
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LockKeyhole className="w-5 h-5 text-primary" />
            {t('منطقة الآباء', 'Parents Zone')}
          </DialogTitle>
          <DialogDescription>
            {t('الرجاء إدخال الرمز السري لولي الأمر للخروج من وضع الطفل.', 'Please enter the parent PIN to exit child mode.')}
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="py-6 flex flex-col items-center gap-6">
          <Input 
            type="password" 
            inputMode="numeric"
            pattern="\d*"
            maxLength={4}
            value={pin}
            onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0,4))}
            className="text-4xl text-center tracking-[1em] h-16 w-64 bg-muted/50 border-primary/20 focus-visible:ring-primary"
            placeholder="••••"
            autoFocus
            dir="ltr"
          />
          <Button 
            type="submit" 
            size="lg" 
            className="w-full"
            disabled={pin.length !== 4 || verifyMutation.isPending}
          >
            {t('تأكيد', 'Verify')}
          </Button>
          <Button variant="ghost" type="button" onClick={async () => { await logout(); window.location.href='/'; }} className="text-muted-foreground w-full">
            <UserX className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
            {t('تسجيل خروج بالكامل', 'Log out completely')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
