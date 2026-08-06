import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetSubject, getGetSubjectQueryKey } from '@workspace/api-client-react';
import { Link, useParams } from 'wouter';
import { ArrowRight, ArrowLeft, PlayCircle, CheckCircle2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function KidSubject() {
  const { t, dir, lang } = useI18n();
  const params = useParams();
  const id = parseInt(params.id || '0');
  
  const { data: subject, isLoading } = useGetSubject(id, { 
    query: { enabled: !!id, queryKey: getGetSubjectQueryKey(id) } 
  });

  const ArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  if (isLoading) return <div className="min-h-screen p-8 animate-pulse"><div className="h-32 bg-muted rounded-3xl mb-8" /><div className="space-y-4">{[1,2,3].map(i => <div key={i} className="h-20 bg-muted rounded-2xl" />)}</div></div>;
  if (!subject) return null;

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <Button variant="ghost" asChild className="mb-6 -ml-4 rtl:-mr-4 hover:bg-transparent">
          <Link href="/kid">
            <ArrowIcon className="w-6 h-6 mr-2 rtl:ml-2 rtl:mr-0" />
            <span className="text-lg font-bold">{t('العودة للرئيسية', 'Back to Home')}</span>
          </Link>
        </Button>

        {/* Subject Header */}
        <div className="bg-card rounded-[2.5rem] p-8 md:p-12 shadow-sm border mb-12 flex items-center gap-8 relative overflow-hidden" style={{ borderColor: `${subject.color}40` }}>
          <div className="absolute top-0 right-0 w-64 h-64 opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" style={{ backgroundColor: subject.color }} />
          <div className="w-24 h-24 rounded-[2rem] bg-background flex items-center justify-center text-5xl shadow-sm z-10" style={{ color: subject.color }}>
            {subject.icon}
          </div>
          <div className="z-10">
            <h1 className="text-4xl md:text-5xl font-black mb-2">{lang === 'ar' ? subject.nameAr : subject.nameEn}</h1>
            <p className="text-muted-foreground text-lg">{t('استكشف وتعلم أشياء مدهشة!', 'Explore and learn amazing things!')}</p>
          </div>
        </div>

        {/* Units List */}
        <div className="space-y-12">
          {subject.units?.map((unit, uIdx) => (
            <div key={unit.id} className="relative">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-10 h-10 rounded-full flex items-center justify-center font-black text-white" style={{ backgroundColor: subject.color }}>
                  {uIdx + 1}
                </div>
                <h2 className="text-2xl font-bold">{lang === 'ar' ? unit.titleAr : unit.titleEn}</h2>
              </div>

              <div className="grid gap-4 pl-5 md:pl-14 rtl:pl-0 rtl:pr-5 md:rtl:pr-14">
                {unit.lessons?.map((lesson, lIdx) => {
                  const isLocked = uIdx > 0 && !subject.units[uIdx - 1]?.lessons?.every(l => l.completed); // Simple progressive lock logic mock
                  
                  return (
                    <Link key={lesson.id} href={isLocked ? '#' : `/kid/lessons/${lesson.id}`} className={`flex items-center p-4 md:p-6 rounded-[2rem] border-2 transition-all ${
                        isLocked 
                          ? 'bg-muted/30 border-transparent opacity-60 cursor-not-allowed' 
                          : lesson.completed 
                            ? 'bg-card border-green-500/30 hover:border-green-500 shadow-sm'
                            : 'bg-card border-transparent hover:border-primary shadow-sm hover:shadow-md hover:-translate-y-1'
                      }`}>
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 mr-4 rtl:ml-4 rtl:mr-0 ${
                          isLocked ? 'bg-muted text-muted-foreground' : 
                          lesson.completed ? 'bg-green-100 text-green-600' : 
                          `bg-primary/10 text-primary`
                        }`}>
                          {isLocked ? <Lock className="w-6 h-6" /> : 
                           lesson.completed ? <CheckCircle2 className="w-6 h-6" /> : 
                           <PlayCircle className="w-6 h-6 ml-1 rtl:mr-1 rtl:ml-0" />}
                        </div>
                        
                        <div className="flex-1">
                          <h3 className={`text-lg md:text-xl font-bold ${isLocked ? 'text-muted-foreground' : 'text-foreground'}`}>
                            {lIdx + 1}. {lang === 'ar' ? lesson.titleAr : lesson.titleEn}
                          </h3>
                          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
                            <span>⏱️ {lesson.durationMinutes} {t('دقيقة', 'mins')}</span>
                            {lesson.score !== null && lesson.score !== undefined && (
                              <span className="text-green-600 font-bold">🎯 {lesson.score}%</span>
                            )}
                          </div>
                        </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
