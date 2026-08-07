import { ArrowLeft } from 'lucide-react';
import { BrickIcon } from './Icons';

export function CTA() {
  return (
    <section className="py-24 px-6 text-center bg-gradient-to-br from-[#00B140] to-[#043316] relative overflow-hidden z-20">
      <div className="absolute inset-0 bg-grid-pattern opacity-10 pointer-events-none" />
      
      <div className="relative z-10 max-w-2xl mx-auto flex flex-col items-center">
        <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mb-8 backdrop-blur-sm border border-white/20">
          <BrickIcon className="w-8 h-8 text-secondary" />
        </div>
        
        <h2 className="text-3xl md:text-5xl font-black text-white leading-tight mb-4 drop-shadow-md">
          مكعّبك وُضع.<br/>الآن احجز مكان طفلك بين البُناة الحقيقيين.
        </h2>
        
        <p className="text-white/80 text-lg md:text-xl mb-10 font-medium">
          الحصة الأولى مجانية · أونلاين أو حضوري · شمال الرياض
        </p>

        <a 
          href="https://wa.me/966505558387?text=أريد%20تسجيل%20طفلي%20في%20حملة%20أطفالنا%20يبنون%20وطننا"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative inline-flex items-center justify-center gap-3 bg-secondary text-secondary-foreground font-black text-lg md:text-xl px-8 py-5 rounded-2xl overflow-hidden transition-transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-secondary/30 active:translate-y-0"
        >
          <span className="relative z-10 flex items-center gap-3">
            سجّل طفلك الآن — واتساب
            <ArrowLeft className="w-6 h-6 transition-transform group-hover:-translate-x-1" />
          </span>
          <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
        </a>
      </div>
    </section>
  );
}
