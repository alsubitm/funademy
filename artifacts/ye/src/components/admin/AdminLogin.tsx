'use client';

import { useState } from 'react';
import { KiteMark, Wordmark } from '@/components/brand/FunAdemyMark';

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
    <div className="min-h-[100dvh] flex items-center justify-center relative overflow-hidden bg-[#051036]" dir="rtl">
      {/* Blueprint background layer */}
      <div className="absolute inset-0 bpgrid opacity-30 pointer-events-none"></div>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(34,218,255,0.1),transparent_70%)] pointer-events-none"></div>
      
      <div className="relative z-10 w-full max-w-sm px-6">
        <div className="bg-[#101A38]/80 backdrop-blur-xl border border-white/10 p-8 rounded-[32px] shadow-2xl relative overflow-hidden">
          {/* Top glow */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#22DAFF] to-transparent opacity-50"></div>
          
          <div className="text-center mb-10 flex flex-col items-center">
            <div className="w-20 h-20 bg-gradient-to-br from-[#1C54CB] to-[#11388E] rounded-2xl mb-6 shadow-[0_12px_24px_rgba(28,84,203,0.3)] flex items-center justify-center relative border border-white/10">
              <KiteMark size={50} dark full={false} className="relative z-10" />
            </div>
            <Wordmark lang="ar" className="text-3xl mb-2" style={{ color: '#fff', '--wm-fun': '#FFCA17', '--wm-ademy': '#fff' } as React.CSSProperties} />
            <p className="text-[#9FC0FF] text-sm font-mono tracking-widest mt-1 uppercase">Mission Control</p>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="رمز الدخول..."
                className="w-full px-5 py-4 bg-white/5 border border-white/10 rounded-2xl focus:outline-none focus:border-[#FFCA17] focus:bg-white/10 text-center text-xl tracking-[0.2em] text-white transition-all font-mono placeholder:text-white/20"
                dir="ltr"
                autoFocus
              />
            </div>
            
            {error && (
              <div className="text-[#FFCA17] text-sm font-bold text-center bg-[#FFCA17]/10 py-2 rounded-lg border border-[#FFCA17]/20">
                رمز الدخول غير صحيح
              </div>
            )}
            
            <button 
              type="submit" 
              disabled={loading || !password}
              className="w-full bg-[#FFCA17] text-[#101A38] font-display font-bold text-lg py-4 rounded-2xl shadow-[0_6px_0_#D69F00] hover:translate-y-[-2px] hover:shadow-[0_8px_0_#D69F00] active:translate-y-[4px] active:shadow-[0_2px_0_#D69F00] transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-[0_6px_0_#D69F00] flex justify-center items-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-[#101A38]/30 border-t-[#101A38] rounded-full animate-spin"></div>
              ) : 'دخول'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
