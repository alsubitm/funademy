import React from 'react';
import { Route, Switch, useLocation } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { ParentGate } from '@/components/auth/ParentGate';
import { Button } from '@/components/ui/button';
import { ShieldCheck } from 'lucide-react';
import KidHome from '@/pages/KidHome';
import KidSubject from '@/pages/KidSubject';

import KidLesson from '@/pages/KidLesson';

export function KidLayout({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <div className="fixed top-4 end-4 z-50">
        <ParentGate onVerified={() => setLocation('/app')}>
          <Button variant="secondary" className="rounded-full shadow-md bg-white/90 backdrop-blur hover:bg-white text-foreground border border-border/50">
            <ShieldCheck className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0 text-primary" />
            {t('منطقة الآباء', 'Parents')}
          </Button>
        </ParentGate>
      </div>
      
      <div className="flex-1">
        {children || (
          <Switch>
            <Route path="/kid" component={KidHome} />
            <Route path="/kid/subjects/:id" component={KidSubject} />
            <Route path="/kid/lessons/:id" component={KidLesson} />
          </Switch>
        )}
      </div>
    </div>
  );
}
