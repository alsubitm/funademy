import React, { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { useGetLesson, useCompleteLesson, getGetLessonQueryKey } from '@workspace/api-client-react';
import { Link, useParams, useLocation } from 'wouter';
import { ArrowRight, ArrowLeft, CheckCircle2, Play, Pause, RotateCcw, Award, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';

export default function KidLesson() {
  const { t, dir, lang } = useI18n();
  const params = useParams();
  const id = parseInt(params.id || '0');
  const [, setLocation] = useLocation();
  
  const { data: lesson, isLoading } = useGetLesson(id, { query: { enabled: !!id, queryKey: getGetLessonQueryKey(id) } });
  const completeMutation = useCompleteLesson();

  const [stage, setStage] = useState<'video' | 'exercises' | 'reward'>('video');
  const [currentExerciseIdx, setCurrentExerciseIdx] = useState(0);
  const [answers, setAnswers] = useState<{exerciseId: number, answer: string, correct: boolean}[]>([]);
  const [startTime] = useState(Date.now());
  const [rewardData, setRewardData] = useState<any>(null);

  const ArrowIcon = dir === 'rtl' ? ArrowRight : ArrowLeft;

  if (isLoading) return <div className="min-h-screen p-8 animate-pulse"><div className="h-[60vh] bg-muted rounded-[3rem]" /></div>;
  if (!lesson) return null;

  const currentExercise = lesson.exercises?.[currentExerciseIdx];
  const progressPercent = ((currentExerciseIdx) / (lesson.exercises?.length || 1)) * 100;

  const handleAnswer = (answer: string) => {
    if (!currentExercise) return;
    
    const isCorrect = answer === currentExercise.correctAnswer;
    const updatedAnswers = [...answers, { exerciseId: currentExercise.id, answer, correct: isCorrect }];
    setAnswers(updatedAnswers);

    if (isCorrect) {
      // Correct answer visual handled by button state
    }

    setTimeout(() => {
      if (currentExerciseIdx < (lesson.exercises?.length || 0) - 1) {
        setCurrentExerciseIdx(prev => prev + 1);
      } else {
        finishLesson(updatedAnswers);
      }
    }, 1000);
  };

  const finishLesson = (finalAnswers = answers) => {
    const timeSpentSeconds = Math.floor((Date.now() - startTime) / 1000);
    completeMutation.mutate({
      id,
      data: { answers: finalAnswers.map(({ exerciseId, answer }) => ({ exerciseId, answer })), timeSpentSeconds }
    }, {
      onSuccess: (res) => {
        setRewardData(res);
        setStage('reward');
      }
    });
  };

  if (stage === 'reward' && rewardData) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <div className="text-center max-w-lg w-full bg-card p-12 rounded-[3rem] shadow-xl border animate-in zoom-in duration-500">
          <div className="w-32 h-32 mx-auto bg-yellow-100 text-yellow-500 rounded-full flex items-center justify-center mb-8 shadow-inner">
            <Award className="w-16 h-16" />
          </div>
          <h1 className="text-4xl font-black mb-4 text-foreground">{t('عمل رائع!', 'Amazing Job!')}</h1>
          <p className="text-xl text-muted-foreground mb-8">
            {t('لقد أكملت الدرس بنجاح', 'You completed the lesson successfully')}
          </p>

          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-muted rounded-2xl p-4 flex flex-col items-center">
              <Star className="w-8 h-8 text-yellow-500 fill-yellow-500 mb-2" />
              <span className="text-2xl font-bold text-foreground">+{rewardData.xpEarned}</span>
              <span className="text-sm text-muted-foreground">{t('نقطة', 'XP')}</span>
            </div>
            <div className="bg-muted rounded-2xl p-4 flex flex-col items-center">
              <CheckCircle2 className="w-8 h-8 text-green-500 mb-2" />
              <span className="text-2xl font-bold text-foreground">{rewardData.score}%</span>
              <span className="text-sm text-muted-foreground">{t('النتيجة', 'Score')}</span>
            </div>
          </div>

          <Button size="lg" className="w-full h-16 text-xl rounded-2xl" asChild>
            <Link href={`/kid/subjects/${lesson.subjectId}`}>
              {t('العودة للمادة', 'Back to Subject')}
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans">
      <header className="p-4 md:p-8 flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild className="shrink-0 hover:bg-transparent">
          <Link href={`/kid/subjects/${lesson.subjectId}`}>
            <ArrowIcon className="w-8 h-8" />
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl md:text-3xl font-bold truncate">{lang === 'ar' ? lesson.titleAr : lesson.titleEn}</h1>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full p-4 md:p-8 flex flex-col">
        {stage === 'video' && (
          <div className="flex-1 flex flex-col items-center animate-in fade-in">
            <div className="w-full aspect-video bg-black rounded-[2rem] overflow-hidden shadow-xl mb-8 border-4 border-border">
              {lesson.videoType === 'youtube' ? (
                <iframe 
                  src={lesson.videoUrl.replace('watch?v=', 'embed/')} 
                  className="w-full h-full" 
                  allowFullScreen 
                  title="Video Lesson"
                />
              ) : (
                <video src={lesson.videoUrl} controls className="w-full h-full object-cover" />
              )}
            </div>
            {lesson.exercises?.length > 0 && (
              <Button size="lg" className="h-16 px-12 text-2xl rounded-full shadow-lg" onClick={() => setStage('exercises')}>
                {t('جاهز للتحدي؟', 'Ready for the challenge?')}
                <ArrowLeft className="w-6 h-6 ml-3 rtl:mr-3 rtl:ml-0 rotate-180 rtl:rotate-0" />
              </Button>
            )}
            {lesson.exercises?.length === 0 && (
              <Button size="lg" className="h-16 px-12 text-2xl rounded-full shadow-lg" onClick={() => finishLesson()}>
                {t('إنهاء الدرس', 'Finish Lesson')}
              </Button>
            )}
          </div>
        )}

        {stage === 'exercises' && currentExercise && (
          <div className="flex-1 flex flex-col max-w-3xl w-full mx-auto animate-in slide-in-from-right-8">
            <div className="mb-8">
              <div className="flex justify-between text-sm font-bold text-muted-foreground mb-2 px-1">
                <span>{t(`سؤال ${currentExerciseIdx + 1} من ${lesson.exercises.length}`, `Question ${currentExerciseIdx + 1} of ${lesson.exercises.length}`)}</span>
              </div>
              <Progress value={progressPercent} className="h-4 rounded-full" />
            </div>

            <Card className="flex-1 rounded-[3rem] p-8 md:p-12 border-4 shadow-sm flex flex-col text-center">
              <h2 className="text-3xl md:text-4xl font-black mb-12 flex-1 flex items-center justify-center leading-relaxed">
                {lang === 'ar' ? currentExercise.promptAr : currentExercise.promptEn}
              </h2>
              
              <div className={`grid gap-4 ${currentExercise.type === 'picture_select' ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'}`}>
                {currentExercise.options.map((option, idx) => {
                  const isAnswered = answers.find(a => a.exerciseId === currentExercise.id);
                  const isThisSelected = isAnswered?.answer === option;
                  const isCorrect = option === currentExercise.correctAnswer;
                  
                  let btnStateClass = 'bg-muted hover:bg-primary/10 hover:border-primary border-transparent';
                  if (isAnswered) {
                    if (isThisSelected) {
                      btnStateClass = isCorrect ? 'bg-green-100 border-green-500 text-green-700' : 'bg-red-100 border-red-500 text-red-700';
                    } else if (isCorrect) {
                      btnStateClass = 'bg-green-100 border-green-500 text-green-700 opacity-50';
                    } else {
                      btnStateClass = 'opacity-50 grayscale';
                    }
                  }

                  return (
                    <button
                      key={idx}
                      disabled={!!isAnswered}
                      onClick={() => handleAnswer(option)}
                      className={`min-h-[5rem] p-6 rounded-2xl border-4 text-xl md:text-2xl font-bold transition-all duration-300 ${btnStateClass} ${currentExercise.type === 'picture_select' ? 'text-6xl' : ''}`}
                    >
                      {option}
                    </button>
                  );
                })}
              </div>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
