'use client';

import { useState, useEffect } from 'react';

export function ContentTab() {
  const [data, setData] = useState({ testimonials: [] as any[], faqs: [] as any[] });
  const [loading, setLoading] = useState(true);

  const fetchContent = async () => {
    try {
      const res = await fetch('/svc/admin/content');
      if (res.status === 401) { window.location.reload(); return; }
      if (res.ok) setData(await res.json());
    } catch {
      // keep previous data
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchContent(); }, []);

  const updateItem = async (type: string, id: number, updates: any) => {
    const res = await fetch('/svc/admin/content', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, id, data: updates })
    });
    if (res.ok) fetchContent();
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="w-8 h-8 border-4 border-[#DFE5F2] border-t-[#1C54CB] rounded-full animate-spin"></div>
      <div className="text-[#5F6B92] font-bold font-mono tracking-widest text-sm uppercase">LOADING...</div>
    </div>
  );

  return (
    <div className="space-y-12">
      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[#FFCA17]/20 text-[#D69F00] rounded-xl flex items-center justify-center shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-[#101A38]">الأسئلة الشائعة (FAQs)</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.faqs.map(faq => (
            <div key={faq.id} className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2] transition-all hover:border-[#1C54CB]/30 hover:shadow-[0_12px_40px_rgba(28,84,203,0.08)] flex flex-col group relative overflow-hidden">
              {faq.published && <div className="absolute top-0 right-0 w-2 h-full bg-[#1C54CB]"></div>}
              
              <div className="flex justify-between items-start mb-4">
                <input 
                  defaultValue={faq.questionAr}
                  onBlur={e => e.target.value !== faq.questionAr && updateItem('faq', faq.id, { questionAr: e.target.value })}
                  className="font-bold text-lg text-[#101A38] w-full bg-transparent border-b-2 border-transparent focus:border-[#FFCA17] outline-none pb-1 transition-colors"
                  placeholder="السؤال..."
                />
                <label className="flex items-center gap-2 text-xs font-bold text-[#5F6B92] whitespace-nowrap mr-4 cursor-pointer bg-[#F7FAFF] px-3 py-1.5 rounded-lg border border-[#DFE5F2] hover:bg-[#F0F5FF]">
                  <input type="checkbox" checked={faq.published} onChange={e => updateItem('faq', faq.id, { published: e.target.checked })} className="w-4 h-4 rounded text-[#1C54CB] focus:ring-[#1C54CB]" />
                  منشور
                </label>
              </div>
              <textarea 
                defaultValue={faq.answerAr}
                onBlur={e => e.target.value !== faq.answerAr && updateItem('faq', faq.id, { answerAr: e.target.value })}
                className="w-full text-sm text-[#5F6B92] font-medium bg-[#F7FAFF] p-4 rounded-xl border-2 border-transparent focus:border-[#1C54CB]/20 focus:bg-white outline-none min-h-[100px] resize-y transition-colors leading-relaxed"
                placeholder="الإجابة باللغة العربية..."
              />
              <div className="mt-6 pt-5 border-t border-[#DFE5F2] space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">Question (EN)</label>
                  <input 
                    defaultValue={faq.questionEn}
                    onBlur={e => e.target.value !== faq.questionEn && updateItem('faq', faq.id, { questionEn: e.target.value })}
                    className="w-full text-sm font-medium bg-[#F7FAFF] px-3 py-2 rounded-lg border border-transparent focus:border-[#1C54CB]/20 outline-none dir-ltr text-left transition-colors"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">Answer (EN)</label>
                  <textarea 
                    defaultValue={faq.answerEn}
                    onBlur={e => e.target.value !== faq.answerEn && updateItem('faq', faq.id, { answerEn: e.target.value })}
                    className="w-full text-sm font-medium bg-[#F7FAFF] px-3 py-2 rounded-lg border border-transparent focus:border-[#1C54CB]/20 outline-none dir-ltr text-left min-h-[60px] resize-y transition-colors"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-[rgba(34,218,255,0.15)] text-[#0C85A3] rounded-xl flex items-center justify-center shadow-sm">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          </div>
          <h2 className="text-2xl font-display font-bold text-[#101A38]">آراء العملاء (Testimonials)</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {data.testimonials.map(t => (
            <div key={t.id} className="bg-white p-6 rounded-[24px] shadow-[0_8px_30px_rgba(7,17,42,0.04)] border border-[#DFE5F2] relative transition-all hover:border-[#1C54CB]/30 hover:shadow-[0_12px_40px_rgba(28,84,203,0.08)] group overflow-hidden">
               {t.published && <div className="absolute top-0 right-0 w-2 h-full bg-[#22DAFF]"></div>}
               
               <div className="flex justify-between items-start mb-4">
                 <input 
                   defaultValue={t.nameAr}
                   onBlur={e => e.target.value !== t.nameAr && updateItem('testimonial', t.id, { nameAr: e.target.value })}
                   className="font-bold text-xl text-[#1C54CB] bg-transparent border-b-2 border-transparent focus:border-[#FFCA17] outline-none w-2/3 pb-1 transition-colors"
                   placeholder="الاسم"
                 />
                 <label className="flex items-center gap-2 text-xs font-bold text-[#5F6B92] cursor-pointer bg-[#F7FAFF] px-3 py-1.5 rounded-lg border border-[#DFE5F2] hover:bg-[#F0F5FF]">
                   <input type="checkbox" checked={t.published} onChange={e => updateItem('testimonial', t.id, { published: e.target.checked })} className="w-4 h-4 rounded text-[#1C54CB] focus:ring-[#1C54CB]" />
                   منشور
                 </label>
               </div>
               
               <div className="text-xs text-[#5F6B92] mb-5 flex flex-wrap gap-2">
                 <input 
                   defaultValue={t.area}
                   onBlur={e => e.target.value !== t.area && updateItem('testimonial', t.id, { area: e.target.value })}
                   className="bg-[#F7FAFF] px-3 py-2 rounded-lg w-full sm:w-1/3 border border-[#DFE5F2] focus:border-[#1C54CB]/40 outline-none font-bold transition-colors"
                   placeholder="الحي"
                 />
                 <input 
                   defaultValue={t.programAr}
                   onBlur={e => e.target.value !== t.programAr && updateItem('testimonial', t.id, { programAr: e.target.value })}
                   className="bg-[#F7FAFF] px-3 py-2 rounded-lg w-full sm:flex-1 border border-[#DFE5F2] focus:border-[#1C54CB]/40 outline-none font-bold transition-colors text-[#1C54CB]"
                   placeholder="البرنامج"
                 />
               </div>

               <div className="relative">
                 <span className="absolute -top-3 -right-2 text-4xl text-[#FFCA17]/20 font-serif leading-none">❝</span>
                 <textarea 
                   defaultValue={t.quoteAr}
                   onBlur={e => e.target.value !== t.quoteAr && updateItem('testimonial', t.id, { quoteAr: e.target.value })}
                   className="w-full text-base text-[#101A38] font-medium bg-[#F7FAFF] p-4 rounded-xl border-2 border-transparent focus:border-[#1C54CB]/20 focus:bg-white outline-none min-h-[100px] resize-y transition-colors relative z-10 leading-relaxed"
                   placeholder="نص الرأي..."
                 />
               </div>
               
               <div className="mt-5 pt-5 border-t border-[#DFE5F2]">
                 <label className="text-[10px] font-bold text-[#5F6B92] uppercase tracking-wider mb-1 block">Quote (EN)</label>
                 <textarea 
                   defaultValue={t.quoteEn}
                   onBlur={e => e.target.value !== t.quoteEn && updateItem('testimonial', t.id, { quoteEn: e.target.value })}
                   className="w-full text-sm font-medium bg-[#F7FAFF] px-3 py-2 rounded-lg border border-transparent focus:border-[#1C54CB]/20 outline-none dir-ltr text-left min-h-[60px] resize-y transition-colors"
                   placeholder="Quote translation..."
                 />
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
