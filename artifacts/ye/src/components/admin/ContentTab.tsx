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
    if (res.ok) {
      // Opting for simple blind refresh on update
      fetchContent();
    }
  };

  if (loading) return <div className="p-8 text-center text-[#54618C] font-bold">جاري التحميل...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-display font-bold text-[#101A38] mb-4">الأسئلة الشائعة (FAQs)</h2>
        <div className="space-y-4">
          {data.faqs.map(faq => (
            <div key={faq.id} className="bg-white p-5 rounded-2xl shadow-sm border border-[#E4E9F5] transition-all hover:border-[#2764D6]">
              <div className="flex justify-between items-start mb-3">
                <input 
                  defaultValue={faq.questionAr}
                  onBlur={e => e.target.value !== faq.questionAr && updateItem('faq', faq.id, { questionAr: e.target.value })}
                  className="font-bold text-lg text-[#101A38] w-full bg-transparent border-b-2 border-transparent focus:border-[#E4E9F5] outline-none pb-1"
                />
                <label className="flex items-center gap-2 text-xs font-bold text-[#54618C] whitespace-nowrap mr-4 cursor-pointer">
                  <input type="checkbox" checked={faq.published} onChange={e => updateItem('faq', faq.id, { published: e.target.checked })} className="w-4 h-4 rounded text-[#2764D6] focus:ring-[#2764D6]" />
                  منشور
                </label>
              </div>
              <textarea 
                defaultValue={faq.answerAr}
                onBlur={e => e.target.value !== faq.answerAr && updateItem('faq', faq.id, { answerAr: e.target.value })}
                className="w-full text-sm text-[#54618C] font-medium bg-[#F5F8FF] p-3 rounded-xl border border-transparent focus:border-[#E4E9F5] outline-none min-h-[80px] resize-y"
              />
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#E4E9F5]">
                <div>
                  <label className="text-xs font-bold text-[#9DA9CF]">Question (EN)</label>
                  <input 
                    defaultValue={faq.questionEn}
                    onBlur={e => e.target.value !== faq.questionEn && updateItem('faq', faq.id, { questionEn: e.target.value })}
                    className="w-full text-sm text-[#54618C] font-medium bg-transparent border-b border-[#E4E9F5] outline-none dir-ltr text-left mt-1 py-1 focus:border-[#2764D6]"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-[#9DA9CF]">Answer (EN)</label>
                  <input 
                    defaultValue={faq.answerEn}
                    onBlur={e => e.target.value !== faq.answerEn && updateItem('faq', faq.id, { answerEn: e.target.value })}
                    className="w-full text-sm text-[#54618C] font-medium bg-transparent border-b border-[#E4E9F5] outline-none dir-ltr text-left mt-1 py-1 focus:border-[#2764D6]"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className="text-2xl font-display font-bold text-[#101A38] mb-4">آراء العملاء (Testimonials)</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.testimonials.map(t => (
            <div key={t.id} className="bg-white p-5 rounded-2xl shadow-sm border border-[#E4E9F5] relative transition-all hover:border-[#2764D6]">
               <label className="absolute top-5 left-5 flex items-center gap-2 text-xs font-bold text-[#54618C] cursor-pointer">
                  <input type="checkbox" checked={t.published} onChange={e => updateItem('testimonial', t.id, { published: e.target.checked })} className="w-4 h-4 rounded text-[#2764D6] focus:ring-[#2764D6]" />
                  منشور
                </label>
                
               <div className="mb-2">
                 <input 
                   defaultValue={t.nameAr}
                   onBlur={e => e.target.value !== t.nameAr && updateItem('testimonial', t.id, { nameAr: e.target.value })}
                   className="font-bold text-lg text-[#2764D6] bg-transparent border-b-2 border-transparent focus:border-[#E4E9F5] outline-none w-2/3 pb-1"
                   placeholder="الاسم"
                 />
               </div>
               
               <div className="text-xs text-[#54618C] mb-4 flex gap-2">
                 <input 
                   defaultValue={t.area}
                   onBlur={e => e.target.value !== t.area && updateItem('testimonial', t.id, { area: e.target.value })}
                   className="bg-[#F5F8FF] px-3 py-1.5 rounded-lg w-1/3 border border-transparent focus:border-[#E4E9F5] outline-none font-medium"
                   placeholder="الحي"
                 />
                 <input 
                   defaultValue={t.programAr}
                   onBlur={e => e.target.value !== t.programAr && updateItem('testimonial', t.id, { programAr: e.target.value })}
                   className="bg-[#F5F8FF] px-3 py-1.5 rounded-lg w-1/2 border border-transparent focus:border-[#E4E9F5] outline-none font-medium"
                   placeholder="البرنامج"
                 />
               </div>

               <textarea 
                 defaultValue={t.quoteAr}
                 onBlur={e => e.target.value !== t.quoteAr && updateItem('testimonial', t.id, { quoteAr: e.target.value })}
                 className="w-full text-sm text-[#101A38] font-medium bg-[#F5F8FF] p-3 rounded-xl border border-transparent focus:border-[#E4E9F5] outline-none min-h-[80px] resize-y"
                 placeholder="النص..."
               />
               
               <div className="mt-4 pt-4 border-t border-[#E4E9F5] flex flex-col gap-2">
                 <input 
                   defaultValue={t.quoteEn}
                   onBlur={e => e.target.value !== t.quoteEn && updateItem('testimonial', t.id, { quoteEn: e.target.value })}
                   className="w-full text-xs text-[#54618C] font-medium bg-transparent border-b border-[#E4E9F5] outline-none dir-ltr text-left py-1 focus:border-[#2764D6]"
                   placeholder="Quote (EN)"
                 />
               </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}