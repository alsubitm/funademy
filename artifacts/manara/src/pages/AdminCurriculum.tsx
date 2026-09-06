import React, { useState } from 'react';
import { useListSubjects, useCreateSubject, getListSubjectsQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Search, Edit2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

import { SubjectManager } from '@/components/admin/SubjectManager';

export default function AdminCurriculum() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: subjects, isLoading } = useListSubjects();
  const createMutation = useCreateSubject();

  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({ nameAr: '', nameEn: '', slug: '', icon: '📚', color: '#0077B6' });
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);

  if (selectedSubjectId) {
    return <SubjectManager subjectId={selectedSubjectId} onBack={() => setSelectedSubjectId(null)} />;
  }

  const handleSave = () => {
    if (!formData.nameAr || !formData.slug) return;
    createMutation.mutate({ data: formData }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListSubjectsQueryKey() });
        setIsOpen(false);
        setFormData({ nameAr: '', nameEn: '', slug: '', icon: '📚', color: '#0077B6' });
        toast({ title: 'Subject Created' });
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-6xl mx-auto" dir="ltr">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Curriculum Manager</h1>
          <p className="text-muted-foreground mt-1">Manage subjects, units, and lessons</p>
        </div>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button><PlusCircle className="w-4 h-4 mr-2" /> Add Subject</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Create Subject</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label>Subject Name (Arabic)</Label>
                <Input value={formData.nameAr} onChange={e => setFormData({...formData, nameAr: e.target.value})} dir="rtl" />
              </div>
              <div className="grid gap-2">
                <Label>Subject Name (English)</Label>
                <Input value={formData.nameEn} onChange={e => setFormData({...formData, nameEn: e.target.value})} />
              </div>
              <div className="grid gap-2">
                <Label>Slug</Label>
                <Input value={formData.slug} onChange={e => setFormData({...formData, slug: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Icon (Emoji)</Label>
                  <Input value={formData.icon} onChange={e => setFormData({...formData, icon: e.target.value})} className="text-center text-xl" />
                </div>
                <div className="grid gap-2">
                  <Label>Theme Color</Label>
                  <div className="flex gap-2 h-10">
                    <input type="color" value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="w-10 h-10 rounded border-0 p-0" />
                    <Input value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} className="flex-1 uppercase font-mono" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending}>Save</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {isLoading ? (
          <div className="h-48 bg-muted animate-pulse rounded-xl" />
        ) : (
          subjects?.map(subject => (
            <Card key={subject.id} className="relative overflow-hidden group border-2 transition-colors" style={{ borderColor: 'transparent' }} onMouseOver={e => (e.currentTarget.style.borderColor = subject.color)} onMouseOut={e => (e.currentTarget.style.borderColor = 'transparent')}>
              <div className="absolute top-0 right-0 w-24 h-24 opacity-10 rounded-bl-full" style={{ backgroundColor: subject.color }} />
              <CardHeader className="pb-2">
                <div className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl mb-2 shadow-inner bg-muted" style={{ color: subject.color }}>
                  {subject.icon}
                </div>
                <CardTitle className="text-lg" dir="rtl">{subject.nameAr}</CardTitle>
                <div className="text-sm text-muted-foreground">{subject.nameEn}</div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between text-sm mt-4">
                  <span className="text-muted-foreground">{subject.unitCount || 0} Units</span>
                  <span className="text-muted-foreground">{subject.lessonCount || 0} Lessons</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedSubjectId(subject.id)}>Manage Units</Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
