import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export function Hero() {
  return (
    <section className="relative min-h-[100dvh] w-full flex flex-col items-center justify-center text-center px-6 overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,rgba(0,177,64,0.15)_0%,transparent_60%)] pointer-events-none" />
      
      <div className="relative z-10 max-w-4xl mx-auto flex flex-col items-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="font-mono text-[10px] md:text-sm tracking-[0.2em] text-secondary border border-secondary/30 bg-secondary/5 rounded-full px-4 py-2 mb-8 uppercase"
        >
          YOUNG ENGINEERS RIYADH NORTH · حملة ٢٠٢٦/٢٧
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          className="text-5xl md:text-7xl lg:text-8xl font-black leading-[1.2] md:leading-[1.1] text-foreground tracking-tight"
        >
          أطفالنا يبنون <span className="text-secondary block md:inline mt-2 md:mt-0">وطننا</span>
        </motion.h1>

        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="font-mono text-xs md:text-base tracking-[0.3em] text-primary/80 mt-6 text-center uppercase"
          style={{ direction: 'ltr' }}
        >
          OUR KIDS BUILD OUR HOMELAND
        </motion.div>

        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-8 text-lg md:text-xl text-muted-foreground max-w-lg leading-relaxed"
        >
          هذه ليست صفحة تُقرأ.<br/>
          هذه تجربة — <strong className="text-foreground font-bold">أنت من سيبني الوطن الآن.</strong>
        </motion.p>
      </div>

      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
        className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 text-muted-foreground font-mono text-[10px] md:text-xs tracking-[0.2em]"
      >
        <span>اسحب للأسفل لتبدأ البناء</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown className="w-5 h-5 text-secondary" />
        </motion.div>
      </motion.div>
    </section>
  );
}
