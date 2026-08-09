'use client';

import { useState, useEffect } from 'react';

type Post = {
  id: number;
  slug: string;
  titleAr: string;
  titleEn: string | null;
  excerptAr: string;
  excerptEn: string | null;
  contentAr: string;
  contentEn: string | null;
  coverEmoji: string;
  published: boolean;
  publishedAt: string;
};

const EMPTY_FORM = { slug: '', coverEmoji: '📚', titleAr: '', excerptAr: '', contentAr: '', titleEn: '', excerptEn: '', contentEn: '' };

export function BlogTab() {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);

  const fetchPosts = async () => {
    try {
      const res = await fetch('/svc/admin/blog');
      if (res.status === 401) { window.location.reload(); return; }
      if (res.ok) setPosts((await res.json()).posts);
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPosts(); }, []);

  const createPost = async () => {
    setSaving(true);
    setError('');
    const res = await fetch('/svc/admin/blog', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      setForm(EMPTY_FORM);
      setShowForm(false);
      fetchPosts();
    } else if (res.status === 409) {
      setError('الرابط (slug) مستخدم لمقال آخر.');
    } else {
      setError('تحقق من الحقول: الرابط بأحرف إنجليزية صغيرة وشرطات، والعنوان والمقتطف والمحتوى بالعربية مطلوبة.');
    }
  };

  const updatePost = async (id: number, data: Record<string, unknown>) => {
    const res = await fetch('/svc/admin/blog', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, data }),
    });
    if (res.ok) fetchPosts();
  };

  const deletePost = async (id: number) => {
    if (!confirm('حذف هذا المقال نهائياً؟')) return;
    const res = await fetch('/svc/admin/blog', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) fetchPosts();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin"></div>
      <div className="text-[#5F6B92] font-bold font-mono tracking-widest text-sm uppercase">LOADING...</div>
    </div>
  );

  const inputCls = 'w-full text-sm font-medium bg-[#F7FAFF] px-3 py-2 rounded-lg border border-[#DFE5F2] focus:border-[#1C54CB]/40 outline-none transition-colors';

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#1C54CB]/10 text-[#1C54CB] rounded-xl flex items-center justify-center shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-[#101A38]">المدونة</h2>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setError(''); }}
          className="px-5 py-2.5 bg-[#FFCA17] text-[#101A38] font-bold rounded-xl shadow-sm hover:brightness-95 transition-all"
        >
          {showForm ? 'إغلاق' : '+ مقال جديد'}
        </button>
      </div>

      {showForm && (
        <div className="bg-white p-6 rounded-[24px] border border-[#DFE5F2] shadow-[0_8px_30px_rgba(7,17,42,0.04)] space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">الرابط (slug)</label>
              <input dir="ltr" className={inputCls} value={form.slug} onChange={e => setForm({ ...form, slug: e.target.value })} placeholder="my-article-slug" />
            </div>
            <div>
              <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">إيموجي الغلاف</label>
              <input className={inputCls} value={form.coverEmoji} onChange={e => setForm({ ...form, coverEmoji: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">العنوان (عربي)</label>
            <input className={inputCls} value={form.titleAr} onChange={e => setForm({ ...form, titleAr: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">المقتطف (عربي)</label>
            <textarea className={`${inputCls} min-h-[60px] resize-y`} value={form.excerptAr} onChange={e => setForm({ ...form, excerptAr: e.target.value })} />
          </div>
          <div>
            <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">المحتوى (عربي — فقرات تفصلها أسطر فارغة، و **غامق**)</label>
            <textarea className={`${inputCls} min-h-[160px] resize-y`} value={form.contentAr} onChange={e => setForm({ ...form, contentAr: e.target.value })} />
          </div>
          <details>
            <summary className="text-xs font-bold text-[#5F6B92] cursor-pointer">الترجمة الإنجليزية (اختياري)</summary>
            <div className="space-y-3 mt-3">
              <input dir="ltr" className={inputCls} value={form.titleEn} onChange={e => setForm({ ...form, titleEn: e.target.value })} placeholder="Title (EN)" />
              <textarea dir="ltr" className={`${inputCls} min-h-[50px] resize-y`} value={form.excerptEn} onChange={e => setForm({ ...form, excerptEn: e.target.value })} placeholder="Excerpt (EN)" />
              <textarea dir="ltr" className={`${inputCls} min-h-[120px] resize-y`} value={form.contentEn} onChange={e => setForm({ ...form, contentEn: e.target.value })} placeholder="Content (EN)" />
            </div>
          </details>
          {error && <div className="text-sm font-bold text-red-600">{error}</div>}
          <button onClick={createPost} disabled={saving} className="px-6 py-2.5 bg-[#1C54CB] text-white font-bold rounded-xl shadow-sm hover:brightness-110 transition-all disabled:opacity-50">
            {saving ? 'جارٍ الحفظ...' : 'نشر المقال'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {posts.map(p => (
          <div key={p.id} className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2] relative overflow-hidden transition-all hover:border-[#1C54CB]/30">
            {p.published && <div className="absolute top-0 right-0 w-2 h-full bg-[#1C54CB]"></div>}
            <div className="flex justify-between items-start gap-3 mb-2">
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-3xl">{p.coverEmoji}</span>
                <div className="min-w-0">
                  <input
                    defaultValue={p.titleAr}
                    onBlur={e => e.target.value.trim() && e.target.value !== p.titleAr && updatePost(p.id, { titleAr: e.target.value })}
                    className="font-bold text-lg text-[#101A38] w-full bg-transparent border-b-2 border-transparent focus:border-[#FFCA17] outline-none pb-1 transition-colors"
                  />
                  <div className="text-[11px] text-[#5F6B92] font-mono truncate" dir="ltr">/blog/{p.slug} · {new Date(p.publishedAt).toLocaleDateString('ar-SA')}</div>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold text-[#5F6B92] whitespace-nowrap cursor-pointer bg-[#F7FAFF] px-3 py-1.5 rounded-lg border border-[#DFE5F2] hover:bg-[#F0F5FF]">
                <input type="checkbox" checked={p.published} onChange={e => updatePost(p.id, { published: e.target.checked })} className="w-4 h-4 rounded text-[#1C54CB]" />
                منشور
              </label>
            </div>

            <textarea
              defaultValue={p.excerptAr}
              onBlur={e => e.target.value.trim() && e.target.value !== p.excerptAr && updatePost(p.id, { excerptAr: e.target.value })}
              className="w-full text-sm text-[#5F6B92] font-medium bg-[#F7FAFF] p-3 rounded-xl border-2 border-transparent focus:border-[#1C54CB]/20 focus:bg-white outline-none min-h-[60px] resize-y transition-colors leading-relaxed"
              placeholder="المقتطف..."
            />

            <button onClick={() => setExpanded(expanded === p.id ? null : p.id)} className="text-xs font-bold text-[#1C54CB] mt-2">
              {expanded === p.id ? 'إخفاء المحتوى ▲' : 'تحرير المحتوى ▼'}
            </button>

            {expanded === p.id && (
              <div className="mt-3 space-y-3">
                <textarea
                  defaultValue={p.contentAr}
                  onBlur={e => e.target.value.trim() && e.target.value !== p.contentAr && updatePost(p.id, { contentAr: e.target.value })}
                  className="w-full text-sm font-medium bg-[#F7FAFF] p-3 rounded-xl border-2 border-transparent focus:border-[#1C54CB]/20 focus:bg-white outline-none min-h-[180px] resize-y transition-colors leading-relaxed"
                />
                <div className="pt-3 border-t border-[#DFE5F2] space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">Title (EN)</label>
                    <input dir="ltr" defaultValue={p.titleEn ?? ''} onBlur={e => e.target.value !== (p.titleEn ?? '') && updatePost(p.id, { titleEn: e.target.value })} className="w-full text-sm font-medium bg-[#F7FAFF] px-3 py-2 rounded-lg border border-transparent focus:border-[#1C54CB]/20 outline-none text-left transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">Excerpt (EN)</label>
                    <textarea dir="ltr" defaultValue={p.excerptEn ?? ''} onBlur={e => e.target.value !== (p.excerptEn ?? '') && updatePost(p.id, { excerptEn: e.target.value })} className="w-full text-sm font-medium bg-[#F7FAFF] px-3 py-2 rounded-lg border border-transparent focus:border-[#1C54CB]/20 outline-none text-left min-h-[50px] resize-y transition-colors" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">Content (EN)</label>
                    <textarea dir="ltr" defaultValue={p.contentEn ?? ''} onBlur={e => e.target.value !== (p.contentEn ?? '') && updatePost(p.id, { contentEn: e.target.value })} className="w-full text-sm font-medium bg-[#F7FAFF] px-3 py-2 rounded-lg border border-transparent focus:border-[#1C54CB]/20 outline-none text-left min-h-[120px] resize-y transition-colors" />
                  </div>
                </div>
                <button onClick={() => deletePost(p.id)} className="text-xs font-bold text-red-600 hover:underline">حذف المقال</button>
              </div>
            )}
          </div>
        ))}
      </div>
      {posts.length === 0 && !showForm && (
        <p className="text-center text-[#5F6B92] py-10">لا توجد مقالات بعد — أنشئ أول مقال.</p>
      )}
    </div>
  );
}
