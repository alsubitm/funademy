import React, { useState } from 'react';
import { useGetSubject, useUpdateUnit, useUpdateLesson, useImportExercisesCsv, getGetSubjectQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowUp, ArrowDown, UploadCloud, ChevronLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';

export function SubjectManager({ subjectId, onBack }: { subjectId: number, onBack: () => void }) {
  const { data: subject, isLoading } = useGetSubject(subjectId, { query: { enabled: !!subjectId, queryKey: getGetSubjectQueryKey(subjectId) } });
  const queryClient = useQueryClient();
  const updateUnitMutation = useUpdateUnit();
  const updateLessonMutation = useUpdateLesson();
  const importCsvMutation = useImportExercisesCsv();
  const { toast } = useToast();

  const [importLessonId, setImportLessonId] = useState<number | null>(null);
  const [csvContent, setCsvContent] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);

  if (isLoading) return <div className="h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>;
  if (!subject) return null;

  const moveUnit = (unitId: number, newPosition: number) => {
    updateUnitMutation.mutate({ id: unitId, data: { position: newPosition } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSubjectQueryKey(subjectId) })
    });
  };

  const moveLesson = (lessonId: number, newPosition: number) => {
    updateLessonMutation.mutate({ id: lessonId, data: { position: newPosition } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetSubjectQueryKey(subjectId) })
    });
  };

  const handleImport = () => {
    if (!importLessonId || !csvContent) return;
    importCsvMutation.mutate({ id: importLessonId, data: { csv: csvContent, replace: replaceExisting } }, {
      onSuccess: (res) => {
        toast({
          title: 'Import Successful',
          description: `Imported ${res.imported} exercises. Skipped ${res.skipped}. ${res.errors?.length ? `Errors: ${res.errors.length}` : ''}`,
        });
        setImportLessonId(null);
        setCsvContent('');
        setReplaceExisting(false);
        queryClient.invalidateQueries({ queryKey: getGetSubjectQueryKey(subjectId) });
      },
      onError: (err: any) => {
        toast({ title: 'Import Failed', description: err.message, variant: 'destructive' });
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack}><ChevronLeft className="w-5 h-5" /></Button>
        <div className="w-10 h-10 rounded flex items-center justify-center text-xl shadow-inner bg-muted" style={{ color: subject.color }}>
          {subject.icon}
        </div>
        <h2 className="text-2xl font-bold">{subject.nameEn} ({subject.nameAr})</h2>
      </div>

      <div className="space-y-8 pl-14">
        {subject.units?.map((unit, uIdx) => (
          <Card key={unit.id} className="border-border">
            <CardHeader className="bg-muted/30 py-3 border-b flex flex-row items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex flex-col gap-1">
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={uIdx === 0} onClick={() => moveUnit(unit.id, uIdx - 1)}>
                    <ArrowUp className="w-3 h-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6" disabled={uIdx === (subject.units?.length || 0) - 1} onClick={() => moveUnit(unit.id, uIdx + 1)}>
                    <ArrowDown className="w-3 h-3" />
                  </Button>
                </div>
                <CardTitle className="text-base font-bold">Unit {uIdx + 1}: {unit.titleEn} <span className="text-muted-foreground font-normal">({unit.titleAr})</span></CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y">
                {unit.lessons?.map((lesson, lIdx) => (
                  <div key={lesson.id} className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between hover:bg-muted/10">
                    <div className="flex items-center gap-4 mb-2 sm:mb-0">
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={lIdx === 0} onClick={() => moveLesson(lesson.id, lIdx - 1)}>
                          <ArrowUp className="w-3 h-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-6 w-6" disabled={lIdx === (unit.lessons?.length || 0) - 1} onClick={() => moveLesson(lesson.id, lIdx + 1)}>
                          <ArrowDown className="w-3 h-3" />
                        </Button>
                      </div>
                      <div>
                        <div className="font-medium">Lesson {lIdx + 1}: {lesson.titleEn} <span className="text-muted-foreground font-normal">({lesson.titleAr})</span></div>
                        <div className="text-xs text-muted-foreground mt-1">Duration: {lesson.durationMinutes} mins • Status: {lesson.status}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 pl-10 sm:pl-0">
                      <Button variant="outline" size="sm" onClick={() => setImportLessonId(lesson.id)}>
                        <UploadCloud className="w-4 h-4 mr-2" /> Import CSV
                      </Button>
                    </div>
                  </div>
                ))}
                {(!unit.lessons || unit.lessons.length === 0) && (
                  <div className="p-4 text-center text-sm text-muted-foreground">No lessons in this unit.</div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        {(!subject.units || subject.units.length === 0) && (
          <div className="text-center text-muted-foreground py-8">No units found for this subject.</div>
        )}
      </div>

      <Dialog open={!!importLessonId} onOpenChange={(open) => !open && setImportLessonId(null)}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Import Exercises CSV</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Paste your CSV content below. Required columns (in order):<br/>
              <code className="bg-muted px-1 py-0.5 rounded">type, promptAr, promptEn, options (use | separator), correctAnswer</code>
            </p>
            <Textarea 
              className="font-mono text-xs min-h-[200px]" 
              placeholder={`multiple_choice,ما لون السماء؟,What color is the sky?,أزرق|أحمر|أخضر,أزرق`}
              value={csvContent}
              onChange={e => setCsvContent(e.target.value)}
            />
            <div className="flex items-center gap-2 mt-2">
              <input 
                type="checkbox" 
                id="replace" 
                checked={replaceExisting} 
                onChange={e => setReplaceExisting(e.target.checked)} 
                className="w-4 h-4 rounded border-border"
              />
              <label htmlFor="replace" className="text-sm font-medium">Replace existing exercises (instead of appending)</label>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportLessonId(null)}>Cancel</Button>
            <Button onClick={handleImport} disabled={importCsvMutation.isPending || !csvContent}>
              {importCsvMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <UploadCloud className="w-4 h-4 mr-2" />}
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
