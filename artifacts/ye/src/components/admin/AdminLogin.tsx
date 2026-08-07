'use client';

import { useState } from 'react';
import { KiteMark } from '@/components/brand/FunademyMark';

export function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(false);
    
    try {
      const res = await fetch('/svc/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
      setError(true);
    } catch {
      setError(true);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5F8FF]" dir="rtl">
      <div className="bg-white p-8 rounded-2xl shadow-xl border border-[#E4E9F5] w-full max-w-sm relative overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-[#0D2B6B] to-[#37c8f5]"></div>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-[#0D2B6B] rounded-2xl mb-4 shadow-lg">
            <KiteMark size={40} dark full={false} />
          </div>
          <h1 className="font-display text-2xl font-bold text-[#101A38]">تسجيل الدخول</h1>
          <p className="text-[#54618C] text-sm mt-2">بوابة إدارة Funademy</p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-[#54618C] mb-2">كلمة المرور</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-[#F5F8FF] border border-[#E4E9F5] rounded-xl focus:outline-none focus:border-[#2764D6] text-left text-lg tracking-widest transition-colors"
              dir="ltr"
              autoFocus
            />
          </div>
          
          {error && <div className="text-red-500 text-sm font-bold text-center">كلمة المرور غير صحيحة</div>}
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-[#FFC400] text-[#101A38] font-display font-bold text-lg py-3 rounded-xl shadow-[0_5px_0_#D9A600] hover:translate-y-[-2px] hover:shadow-[0_7px_0_#D9A600] transition-all disabled:opacity-70 flex justify-center"
          >
            {loading ? 'جاري التحقق...' : 'دخول'}
          </button>
        </form>
      </div>
    </div>
  );
}