import React, { useRef, useState } from 'react';
import { useBrickWall } from '@/hooks/use-brick-wall';
import { BrickIcon } from './Icons';
import { ShareCard } from './ShareCard';
import { motion, AnimatePresence } from 'framer-motion';

const BRICK_COLORS = [
  'bg-destructive text-destructive-foreground',
  'bg-secondary text-secondary-foreground',
  'bg-primary text-primary-foreground',
  'bg-accent text-accent-foreground',
  'bg-[#00B140] text-white',
  'bg-[#8E5CD9] text-white'
];

export function BrickWall() {
  const { count, goal, handlePlaceBrick } = useBrickWall();
  const progressPercent =
    goal && goal > 0 ? Math.min(100, Math.round((count / goal) * 1000) / 10) : null;
  const [wallUsed, setWallUsed] = useState(false);
  const wallRef = useRef<HTMLDivElement>(null);
  
  const NCOLS = 12;
  const MAX_ROWS = 10;
  
  const [cols, setCols] = useState<number[][]>(Array.from({ length: NCOLS }, () => []));

  const onClickWall = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!wallRef.current) return;
    setWallUsed(true);
    handlePlaceBrick();
    
    const rect = wallRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width - 1));
    const isRtl = getComputedStyle(wallRef.current).direction === 'rtl';
    const percentX = x / rect.width;
    
    let colIndex = Math.floor(percentX * NCOLS);
    if (isRtl) {
      colIndex = (NCOLS - 1) - colIndex;
    }

    setCols(prev => {
      const newCols = [...prev];
      let targetCol = [...newCols[colIndex]];
      
      if (targetCol.length >= MAX_ROWS) {
        targetCol = [];
      }
      
      const colorIdx = Math.floor(Math.random() * BRICK_COLORS.length);
      targetCol.push(colorIdx);
      newCols[colIndex] = targetCol;
      
      return newCols;
    });
  };

  return (
    <section className="py-24 px-6 text-center bg-gradient-to-b from-[#040c1c] to-[#0a1529] w-full relative z-20">
      <div className="max-w-3xl mx-auto flex flex-col items-center">
        <h2 className="text-3xl md:text-5xl font-black text-foreground mb-3 leading-tight">
          الآن... ضع <span className="text-secondary">مكعّبك</span> في الوطن <BrickIcon className="w-8 h-8 md:w-12 md:h-12 inline-block text-secondary -mt-2" />
        </h2>
        <div className="font-mono text-xs md:text-sm tracking-[0.3em] text-primary/80 uppercase" style={{ direction: 'ltr' }}>
          PLACE YOUR BRICK IN THE HOMELAND
        </div>
        <p className="mt-6 text-muted-foreground text-lg max-w-lg mx-auto">
          كل عائلة تزور هذه الصفحة تضيف مكعّباً إلى جدار الوطن — والجدار الحقيقي يكتمل في معرض <strong className="text-foreground font-bold">وطن مصغّر</strong> بيوم الوطن.
        </p>

        <div className="mt-10 font-black text-6xl md:text-8xl text-secondary flex flex-col items-center">
          <div className="flex items-center gap-4 drop-shadow-[0_0_12px_rgba(255,196,0,0.3)]">
            <span>{count.toLocaleString('ar-EG')}</span>
            <BrickIcon className="w-12 h-12 md:w-16 md:h-16" />
          </div>
          <small className="font-mono text-[10px] md:text-sm tracking-[0.2em] text-primary/70 mt-4 font-semibold uppercase" style={{ direction: 'ltr' }}>
            BRICKS PLACED BY FAMILIES OF RIYADH NORTH
          </small>
        </div>

        {goal !== null && progressPercent !== null && (
          <div className="mt-8 w-full max-w-xl" dir="rtl">
            <div className="flex items-baseline justify-between text-sm mb-2">
              <span className="font-bold text-secondary">
                اكتمل {progressPercent.toLocaleString('ar-EG')}٪
              </span>
              <span className="text-muted-foreground">
                الهدف: {goal.toLocaleString('ar-EG')} مكعب قبل اليوم الوطني
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full bg-card border border-accent/20">
              <div
                className="h-full rounded-full bg-gradient-to-l from-primary to-secondary transition-all duration-700"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              {goal - count > 0
                ? `متبقٍّ ${(goal - count).toLocaleString('ar-EG')} مكعب لنكمل الجدار معاً`
                : 'تحقّق الهدف — مبروك! 🎉'}
            </p>
          </div>
        )}

        <div 
          ref={wallRef}
          onClick={onClickWall}
          className="mt-12 w-full max-w-[800px] h-[300px] md:h-[400px] bg-card border-2 border-dashed border-accent/40 rounded-2xl p-4 cursor-pointer relative flex items-end justify-between gap-1 md:gap-2 shadow-2xl shadow-card/50 overflow-hidden"
        >
          <AnimatePresence>
            {!wallUsed && (
              <motion.div 
                exit={{ opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-10 bg-card/40 backdrop-blur-[1px]"
              >
                <div className="font-mono text-xs md:text-sm tracking-[0.1em] text-accent font-semibold px-4 py-2 bg-card rounded-full shadow-lg border border-accent/20 flex flex-col gap-2 items-center">
                  <span>اضغط في أي مكان لتضيف مكعّبك</span>
                  <span style={{ direction: 'ltr' }} className="text-[10px] md:text-xs">TAP ANYWHERE TO ADD YOUR BRICK &darr;</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          
          {cols.map((col, i) => (
            <div key={i} className="flex-1 flex flex-col-reverse justify-start items-center gap-1 min-h-[1px] h-full">
              {col.map((colorIdx, j) => (
                <div 
                  key={`${i}-${j}`} 
                  className={`w-full h-5 md:h-7 rounded-sm border-b-2 border-r-2 border-l-2 border-t-2 border-card ${BRICK_COLORS[colorIdx]} relative brick-anim shadow-sm`}
                >
                  <div className="absolute -top-[5px] left-1/4 w-1/4 h-[5px] bg-inherit rounded-t-[1px] border-t-2 border-l-2 border-r-2 border-card"></div>
                  <div className="absolute -top-[5px] right-1/4 w-1/4 h-[5px] bg-inherit rounded-t-[1px] border-t-2 border-l-2 border-r-2 border-card"></div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <AnimatePresence>
          {wallUsed && <ShareCard />}
        </AnimatePresence>
      </div>
    </section>
  );
}
