import React, { useState } from 'react';
import { Route, Switch, useLocation, Link } from 'wouter';
import { useI18n } from '@/lib/i18n';
import { ParentGate } from '@/components/auth/ParentGate';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Search, X, PlayCircle } from 'lucide-react';
import KidHome from '@/pages/KidHome';
import KidSubject from '@/pages/KidSubject';
import KidLesson from '@/pages/KidLesson';
import { useSearchLessons, getSearchLessonsQueryKey } from '@workspace/api-client-react';
import { useDebounce } from '@/hooks/use-debounce';

function KidSearch() {
  const { t, lang, dir } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);

  const { data: results, isLoading } = useSearchLessons(
    { q: debouncedQuery }, 
    { query: { enabled: debouncedQuery.length > 1, queryKey: getSearchLessonsQueryKey({ q: debouncedQuery }) } }
  );

  if (!isOpen) {
    return (
      <Button variant="secondary" size="icon" className="rounded-full shadow-md bg-white/90 backdrop-blur hover:bg-white text-foreground border border-border/50 h-10 w-10" onClick={() => setIsOpen(true)}>
        <Search className="w-5 h-5 text-primary" />
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur flex flex-col p-4 md:p-8 animate-in fade-in" dir={dir}>
      <div className="flex items-center gap-4 max-w-3xl mx-auto w-full mb-8 relative">
        <div className="flex-1 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground ltr:left-4 ltr:right-auto" />
          <input 
            autoFocus
            type="text"
            placeholder={t('ابحث عن درس...', 'Search for a lesson...')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full h-16 md:h-20 rounded-[2rem] border-4 border-primary/20 focus:border-primary bg-card text-xl md:text-2xl px-14 outline-none shadow-lg"
          />
        </div>
        <Button variant="ghost" size="icon" className="h-16 w-16 md:h-20 md:w-20 rounded-full shrink-0" onClick={() => { setIsOpen(false); setQuery(''); }}>
          <X className="w-8 h-8 md:w-10 md:h-10" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto max-w-3xl mx-auto w-full">
        {isLoading && debouncedQuery.length > 1 && (
          <div className="flex flex-col gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-24 bg-muted animate-pulse rounded-2xl" />)}
          </div>
        )}
        
        {!isLoading && results && results.length === 0 && (
          <div className="text-center text-muted-foreground mt-12 text-xl">
            {t('لم نجد شيئاً يشبه', 'We couldn\'t find anything like')} "{query}"
          </div>
        )}

        {!isLoading && results && results.length > 0 && (
          <div className="flex flex-col gap-4 pb-20">
            {results.map((item) => (
              <Link key={item.id} href={`/kid/lessons/${item.id}`} onClick={() => { setIsOpen(false); setQuery(''); }} className="bg-card border-2 border-transparent hover:border-primary p-4 md:p-6 rounded-[2rem] flex items-center gap-4 transition-all shadow-sm hover:shadow-md group">
                <div className="w-12 h-12 md:w-16 md:h-16 bg-primary/10 text-primary rounded-full flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <PlayCircle className="w-6 h-6 md:w-8 md:h-8 ml-1 rtl:mr-1 rtl:ml-0" />
                </div>
                <div>
                  <h3 className="text-lg md:text-xl font-bold mb-1">{lang === 'ar' ? item.titleAr : item.titleEn}</h3>
                  <div className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="font-bold text-primary">{item.subjectNameAr}</span>
                    {item.unitTitleAr && <span>• {item.unitTitleAr}</span>}
                    <span>• {item.durationMinutes} {t('دقيقة', 'mins')}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function KidLayout({ children }: { children?: React.ReactNode }) {
  const { t } = useI18n();
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <div className="fixed top-4 end-4 z-40 flex items-center gap-2">
        <KidSearch />
        <ParentGate onVerified={() => setLocation('/app')}>
          <Button variant="secondary" className="rounded-full shadow-md bg-white/90 backdrop-blur hover:bg-white text-foreground border border-border/50 h-10">
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
