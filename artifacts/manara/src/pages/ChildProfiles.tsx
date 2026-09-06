import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useListChildren, useCreateChild, useUpdateChild, useDeleteChild, getListChildrenQueryKey } from '@workspace/api-client-react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit2, Trash2, ShieldAlert } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

const AVATARS = ['🦊', '🦉', '🐱', '🐼', '🦁', '🐯', '🐰', '🐨', '🚀', '⭐', '🎨', '🎸'];

export default function ChildProfiles() {
  const { t } = useI18n();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: children, isLoading } = useListChildren();
  
  const createMutation = useCreateChild();
  const updateMutation = useUpdateChild();
  const deleteMutation = useDeleteChild();

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formData, setFormData] = useState({ name: '', avatar: '🦊', birthYear: new Date().getFullYear() - 6, birthMonth: 1, pin: '', dailyLimitMinutes: 60 });
  
  const [editingId, setEditingId] = useState<number | null>(null);

  const resetForm = () => {
    setFormData({ name: '', avatar: '🦊', birthYear: new Date().getFullYear() - 6, birthMonth: 1, pin: '', dailyLimitMinutes: 60 });
    setEditingId(null);
  };

  const handleSave = () => {
    if (!formData.name || !formData.pin || formData.pin.length !== 4) {
      toast({ title: t('خطأ', 'Error'), description: t('تأكد من إدخال الاسم ورمز PIN المكون من 4 أرقام', 'Ensure name and 4-digit PIN are provided'), variant: 'destructive' });
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: { name: formData.name, avatar: formData.avatar, pin: formData.pin, dailyLimitMinutes: formData.dailyLimitMinutes }
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
          setIsCreateOpen(false);
          resetForm();
          toast({ title: t('تم التحديث', 'Updated'), description: t('تم تحديث بيانات الطفل بنجاح', 'Child profile updated successfully') });
        }
      });
    } else {
      createMutation.mutate({
        data: formData
      }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
          setIsCreateOpen(false);
          resetForm();
          toast({ title: t('تمت الإضافة', 'Added'), description: t('تمت إضافة الطفل بنجاح', 'Child profile added successfully') });
        }
      });
    }
  };

  const handleDelete = (id: number) => {
    if (confirm(t('هل أنت متأكد من حذف هذا الملف؟ لا يمكن التراجع عن هذا الإجراء.', 'Are you sure you want to delete this profile? This cannot be undone.'))) {
      deleteMutation.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListChildrenQueryKey() });
          toast({ title: t('تم الحذف', 'Deleted'), description: t('تم حذف الملف بنجاح', 'Profile deleted successfully') });
        }
      });
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 15 }, (_, i) => currentYear - 3 - i); // roughly ages 3-18

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t('إدارة الأبناء', 'Manage Children')}</h1>
          <p className="text-muted-foreground mt-1">
            {t('أضف وعدل ملفات أبنائك وخصائص الحماية', 'Add and edit your children\'s profiles and safety settings')}
          </p>
        </div>
        <Dialog open={isCreateOpen} onOpenChange={(open) => {
          setIsCreateOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
              {t('إضافة طفل', 'Add Child')}
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>{editingId ? t('تعديل بيانات الطفل', 'Edit Child Profile') : t('إضافة طفل جديد', 'Add New Child')}</DialogTitle>
              <DialogDescription>
                {t('يحدد تاريخ الميلاد المرحلة التعليمية المناسبة للطفل.', 'Birth date determines the appropriate educational band for the child.')}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid gap-2">
                <Label>{t('الاسم', 'Name')}</Label>
                <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder={t('اسم الطفل', 'Child Name')} />
              </div>
              
              <div className="grid gap-2">
                <Label>{t('الصورة الرمزية', 'Avatar')}</Label>
                <div className="flex flex-wrap gap-2">
                  {AVATARS.map(avatar => (
                    <button
                      key={avatar}
                      type="button"
                      onClick={() => setFormData({ ...formData, avatar })}
                      className={`w-12 h-12 text-2xl flex items-center justify-center rounded-xl border-2 transition-all ${formData.avatar === avatar ? 'border-primary bg-primary/10 scale-110' : 'border-transparent bg-muted hover:bg-muted/80'}`}
                    >
                      {avatar}
                    </button>
                  ))}
                </div>
              </div>

              {!editingId && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label>{t('سنة الميلاد', 'Birth Year')}</Label>
                    <Select value={formData.birthYear.toString()} onValueChange={v => setFormData({ ...formData, birthYear: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>{t('شهر الميلاد', 'Birth Month')}</Label>
                    <Select value={formData.birthMonth.toString()} onValueChange={v => setFormData({ ...formData, birthMonth: parseInt(v) })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                          <SelectItem key={m} value={m.toString()}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label>{t('رمز PIN خاص بالطفل', 'Child\'s PIN')}</Label>
                <Input value={formData.pin} onChange={e => setFormData({ ...formData, pin: e.target.value.replace(/\D/g, '').slice(0,4) })} placeholder="••••" dir="ltr" className="text-center tracking-widest font-mono" />
                <p className="text-xs text-muted-foreground">{t('4 أرقام يستخدمها الطفل للدخول لملفه الخاص', '4 digits used by the child to access their profile')}</p>
              </div>

              <div className="grid gap-2">
                <Label>{t('وقت الشاشة اليومي (بالدقائق)', 'Daily Screen Time Limit (mins)')}</Label>
                <Input type="number" value={formData.dailyLimitMinutes} onChange={e => setFormData({ ...formData, dailyLimitMinutes: parseInt(e.target.value) || 60 })} min={15} max={300} step={15} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>{t('إلغاء', 'Cancel')}</Button>
              <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
                {t('حفظ', 'Save')}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2].map(i => <div key={i} className="h-48 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {children?.map((child) => (
            <Card key={child.id} className="relative overflow-hidden group">
              <div className="absolute top-4 end-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                <Button variant="secondary" size="icon" className="h-8 w-8" onClick={() => {
                  setFormData({ name: child.name, avatar: child.avatar, birthYear: child.birthYear, birthMonth: child.birthMonth, pin: '', dailyLimitMinutes: child.dailyLimitMinutes || 60 });
                  setEditingId(child.id);
                  setIsCreateOpen(true);
                }}>
                  <Edit2 className="w-4 h-4" />
                </Button>
                <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleDelete(child.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center">
                  <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-4xl mb-4 shadow-inner border border-background">
                    {child.avatar}
                  </div>
                  <h3 className="font-bold text-xl mb-1">{child.name}</h3>
                  <span className="text-sm font-medium px-2 py-1 rounded-full bg-primary/10 text-primary mb-4">
                    {t(
                      child.band === 'explorers' ? 'المستكشفون' :
                      child.band === 'builders' ? 'البناة' :
                      child.band === 'achievers' ? 'المنجزون' : 'الخريجون',
                      child.band.charAt(0).toUpperCase() + child.band.slice(1)
                    )}
                  </span>
                  
                  <div className="w-full grid grid-cols-2 gap-4 mt-2 pt-4 border-t text-sm">
                    <div className="flex flex-col items-center">
                      <span className="text-muted-foreground">{t('النقاط', 'XP')}</span>
                      <span className="font-bold text-primary">{child.xp}</span>
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-muted-foreground">{t('أيام متتالية', 'Streak')}</span>
                      <span className="font-bold text-secondary">{child.streak} 🔥</span>
                    </div>
                  </div>
                  
                  <div className="w-full flex items-center justify-center gap-2 mt-4 pt-4 border-t text-xs text-muted-foreground">
                    <ShieldAlert className="w-4 h-4" />
                    {child.dailyLimitMinutes 
                      ? t(`الحد اليومي: ${child.dailyLimitMinutes} دقيقة`, `Daily limit: ${child.dailyLimitMinutes} mins`)
                      : t('بدون حد زمني', 'No time limit')}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
