import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetCurriculumOutline } from '@workspace/api-client-react';
import { Button } from '@/components/ui/button';
import { PlayCircle, CheckCircle2, Search } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

import { useSeo } from '@/hooks/use-seo';

export default function Curriculum() {
  const { t, lang, dir } = useI18n();
  const { data: curriculum, isLoading } = useGetCurriculumOutline();
  const [selectedBand, setSelectedBand] = useState<string>('explorers');
  const [playingLessonId, setPlayingLessonId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useSeo(
    'المناهج',
    'نغطي المنهج السعودي بالكامل من رياض الأطفال إلى الثانوية العامة.',
    'Curriculum',
    'We cover the full Saudi curriculum from kindergarten to high school.'
  );

  const bands = [
    { id: 'explorers', labelAr: 'المستكشفون', labelEn: 'Explorers', age: '4-7' },
    { id: 'builders', labelAr: 'البناة', labelEn: 'Builders', age: '8-11' },
    { id: 'achievers', labelAr: 'المنجزون', labelEn: 'Achievers', age: '12-15' },
    { id: 'graduates', labelAr: 'الخريجون', labelEn: 'Graduates', age: '16-18' },
  ];

  const currentOutline = curriculum?.find(c => c.band === selectedBand);
  const playingLesson = currentOutline?.subjects
    .flatMap(s => s.sampleLessons)
    .find(l => l.id === playingLessonId);

  return (
    <div className="py-24 bg-muted/20 min-h-screen">
      <div className="container mx-auto px-4 max-w-6xl">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-extrabold mb-4">{t('مناهج مصممة لكل مرحلة عمرية', 'Curricula Designed for Every Age')}</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t(
              'نغطي المنهج السعودي بالكامل من رياض الأطفال إلى الثانوية العامة. استكشف كيف ينمو المحتوى مع طفلك.',
              'We cover the full Saudi curriculum from kindergarten to high school. Explore how the content grows with your child.'
            )}
          </p>
        </div>

        {/* Band Selector */}
        <div className="flex flex-wrap justify-center gap-4 mb-8">
          {bands.map((band) => (
            <button
              key={band.id}
              onClick={() => setSelectedBand(band.id)}
              className={`px-8 py-4 rounded-full text-lg font-bold transition-all duration-300 ${
                selectedBand === band.id
                  ? `bg-primary text-primary-foreground shadow-lg scale-105`
                  : 'bg-card text-muted-foreground hover:bg-muted border border-border/50'
              }`}
            >
              {lang === 'ar' ? band.labelAr : band.labelEn}
              <span className="block text-sm font-normal opacity-80 mt-1">{band.age} {t('سنوات', 'years')}</span>
            </button>
          ))}
        </div>

        <div className="max-w-md mx-auto mb-16 relative">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground ltr:left-4 ltr:right-auto" />
          <input
            type="text"
            placeholder={t('ابحث في المناهج...', 'Search curriculum...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-12 rounded-full border border-border bg-card px-12 text-sm focus:border-primary outline-none shadow-sm transition-colors"
          />
        </div>

        {isLoading ? (
          <div className="animate-pulse space-y-8">
            <div className="h-32 bg-muted rounded-3xl" />
            <div className="grid md:grid-cols-2 gap-8">
              {[1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-muted rounded-3xl" />)}
            </div>
          </div>
        ) : currentOutline ? (
          <div className="animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="text-center mb-12 max-w-3xl mx-auto">
              <h2 className="text-3xl font-bold mb-4">{lang === 'ar' ? currentOutline.nameAr : currentOutline.nameEn}</h2>
              <p className="text-lg text-muted-foreground leading-relaxed">{lang === 'ar' ? currentOutline.descriptionAr : currentOutline.nameEn + ' Description' /* Mocking english desc since it's missing in schema */}</p>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {currentOutline.subjects
                .filter(subject => 
                  !searchQuery || 
                  subject.nameAr.includes(searchQuery) || 
                  subject.nameEn.toLowerCase().includes(searchQuery.toLowerCase())
                )
                .map((subject, idx) => (
                <div key={idx} className="bg-card rounded-[2.5rem] p-8 shadow-sm border border-border/50 hover:shadow-md transition-shadow relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-48 h-48 opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" style={{ backgroundColor: subject.color }} />
                  
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shadow-sm bg-background" style={{ color: subject.color }}>
                      {subject.icon}
                    </div>
                    <h3 className="text-2xl font-bold">{lang === 'ar' ? subject.nameAr : subject.nameEn}</h3>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider">{t('الوحدات الدراسية:', 'Units:')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {subject.unitTitlesAr.map((unit, i) => (
                        <span key={i} className="px-3 py-1 bg-muted rounded-full text-sm">{unit}</span>
                      ))}
                    </div>
                  </div>

                  {subject.sampleLessons.length > 0 && (
                    <div>
                      <h4 className="text-sm font-bold text-muted-foreground mb-3 uppercase tracking-wider flex items-center gap-2">
                        <PlayCircle className="w-4 h-4" />
                        {t('دروس مجانية للتجربة:', 'Free Sample Lessons:')}
                      </h4>
                      <div className="space-y-3">
                        {subject.sampleLessons.map((lesson) => (
                          <button
                            key={lesson.id}
                            onClick={() => setPlayingLessonId(lesson.id)}
                            className="w-full flex items-center justify-between p-3 rounded-xl border border-primary/20 hover:border-primary/50 hover:bg-primary/5 transition-colors text-right rtl:text-right ltr:text-left"
                          >
                            <span className="font-medium text-sm flex-1">{lang === 'ar' ? lesson.titleAr : lesson.titleEn}</span>
                            <span className="text-xs text-muted-foreground px-2">{lesson.durationMinutes} {t('دقيقة', 'min')}</span>
                            <PlayCircle className="w-5 h-5 text-primary shrink-0" />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center text-muted-foreground py-20">{t('لا تتوفر بيانات حالياً', 'No data available')}</div>
        )}
      </div>

      <Dialog open={!!playingLessonId} onOpenChange={(open) => !open && setPlayingLessonId(null)}>
        <DialogContent className="sm:max-w-4xl p-0 overflow-hidden bg-black border-none rounded-[2rem]">
          <DialogHeader className="p-4 absolute top-0 w-full z-10 bg-gradient-to-b from-black/80 to-transparent text-white">
            <DialogTitle>{lang === 'ar' ? playingLesson?.titleAr : playingLesson?.titleEn}</DialogTitle>
          </DialogHeader>
          <div className="w-full aspect-video flex items-center justify-center bg-muted/10 relative">
            {playingLesson ? (
              <div className="text-center text-white p-8">
                <PlayCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p className="text-xl mb-4">{t('مقطع مرئي تجريبي سيعمل هنا', 'Sample video will play here')}</p>
                <p className="text-muted-foreground">{t('قم بإنشاء حساب لتجربة الدرس كاملاً مع التمارين التفاعلية', 'Create an account to experience the full lesson with interactive exercises')}</p>
              </div>
            ) : (
              <div className="animate-pulse w-16 h-16 rounded-full bg-white/20" />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
