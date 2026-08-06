import React from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetChildHome } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Progress } from '@/components/ui/progress';
import { PlayCircle, Trophy, Flame, Star, AlertOctagon } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function KidHome() {
  const { t, dir, lang } = useI18n();
  const { data: home, isLoading } = useGetChildHome();

  if (isLoading) return <div className="p-8 animate-pulse flex flex-col gap-8"><div className="h-32 bg-muted rounded-2xl" /><div className="h-64 bg-muted rounded-2xl" /></div>;
  if (!home) return null;

  const { child, continueLesson, subjects, todayMinutes, dailyLimitReached } = home;

  return (
    <div className={`min-h-screen bg-background theme-${child.band} p-4 md:p-8 font-sans transition-colors duration-500`}>
      {/* Top Bar */}
      <header className="flex items-center justify-between mb-8 max-w-6xl mx-auto">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-card rounded-2xl flex items-center justify-center text-3xl shadow-sm border border-border/50">
            {child.avatar}
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">{t('أهلاً', 'Hi')} {child.name}!</h1>
            {child.band === 'explorers' && <p className="text-primary font-bold text-lg">{t('جاهز للمرح؟', 'Ready to play?')}</p>}
            {child.band === 'builders' && <p className="text-primary font-bold">{t('لنبنِ المزيد من الإنجازات!', 'Let\'s build more achievements!')}</p>}
            {child.band === 'achievers' && <p className="text-primary font-bold">{t('طريقك للتفوق يبدأ من هنا', 'Your path to excellence starts here')}</p>}
            {child.band === 'graduates' && <p className="text-primary font-bold">{t('استعد لمستقبلك بثقة', 'Prepare for your future with confidence')}</p>}
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-card px-4 py-2 rounded-2xl shadow-sm border border-border/50 flex items-center gap-2">
            <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            <span className="font-black text-xl">{child.xp}</span>
          </div>
          <div className="bg-card px-4 py-2 rounded-2xl shadow-sm border border-border/50 flex items-center gap-2">
            <Flame className="w-6 h-6 text-orange-500 fill-orange-500" />
            <span className="font-black text-xl">{child.streak}</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-12">
        {/* Daily Limit Warning */}
        {dailyLimitReached && (
          <div className="bg-destructive/10 text-destructive p-6 rounded-3xl flex items-center gap-4 border border-destructive/20 animate-in slide-in-from-top-4">
            <AlertOctagon className="w-10 h-10 shrink-0" />
            <div>
              <h3 className="text-xl font-bold">{t('انتهى وقت الشاشة اليومي!', 'Daily screen time reached!')}</h3>
              <p>{t('لقد قضيت وقتاً رائعاً في التعلم اليوم. حان وقت الراحة وتجربة شيء جديد بعيداً عن الشاشة.', 'You had a great learning time today. It\'s time to rest and try something new away from the screen.')}</p>
            </div>
          </div>
        )}

        {/* Continue Lesson Card */}
        {continueLesson && !dailyLimitReached && (
          <section className="relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 rounded-[2.5rem] blur-xl opacity-50 group-hover:opacity-100 transition-opacity" />
            <div className="relative bg-card p-6 md:p-10 rounded-[2.5rem] shadow-sm border border-border overflow-hidden flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="absolute -top-12 -right-12 text-[10rem] opacity-5 select-none" style={{ color: continueLesson.subjectColor }}>
                {continueLesson.subjectIcon}
              </div>
              <div className="relative z-10 flex-1">
                <div className="inline-flex px-3 py-1 rounded-full text-sm font-bold mb-4" style={{ backgroundColor: `${continueLesson.subjectColor}20`, color: continueLesson.subjectColor }}>
                  {continueLesson.subjectNameAr}
                </div>
                <h2 className="text-3xl md:text-4xl font-black mb-2">{t('أكمل من حيث توقفت', 'Continue where you left off')}</h2>
                <p className="text-xl text-muted-foreground">{lang === 'ar' ? continueLesson.titleAr : continueLesson.titleEn}</p>
              </div>
              <Button size="lg" className="w-full md:w-auto h-16 px-10 text-xl rounded-full relative z-10 shadow-lg hover:scale-105 transition-transform" asChild style={{ backgroundColor: continueLesson.subjectColor, color: '#fff' }}>
                <Link href={`/kid/lessons/${continueLesson.lessonId}`}>
                  <PlayCircle className="w-8 h-8 mr-3 rtl:ml-3 rtl:mr-0" />
                  {t('استمرار التعلم', 'Resume Learning')}
                </Link>
              </Button>
            </div>
          </section>
        )}

        {/* Subjects Grid */}
        <section>
          <h2 className="text-2xl font-black mb-6 flex items-center gap-3">
            <Trophy className="w-8 h-8 text-primary" />
            {t('المواد الدراسية', 'Subjects')}
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {subjects.map((subject) => (
              <Link key={subject.id} href={`/kid/subjects/${subject.id}`} className="block bg-card rounded-[2rem] p-6 text-center shadow-sm border border-border/50 hover:shadow-xl hover:-translate-y-2 transition-all duration-300 relative overflow-hidden group">
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity" style={{ backgroundColor: subject.color }} />
                  <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl mb-4 shadow-inner bg-background" style={{ color: subject.color }}>
                    {subject.icon}
                  </div>
                  <h3 className="font-bold text-xl mb-4 text-foreground">{lang === 'ar' ? subject.nameAr : subject.nameEn}</h3>
                  <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${subject.progressPercent || 0}%`, backgroundColor: subject.color }} />
                  </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
