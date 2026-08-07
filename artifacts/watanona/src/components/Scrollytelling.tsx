import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion';

export function Scrollytelling() {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldReduceMotion = useReducedMotion();
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  });

  const progress = shouldReduceMotion ? 1 : scrollYProgress;

  // Words Opacity
  const w0 = useTransform(progress, [0, 0.1, 0.2, 0.25], [1, 1, 1, 0]);
  const w1 = useTransform(progress, [0.2, 0.25, 0.45, 0.5], [0, 1, 1, 0]);
  const w2 = useTransform(progress, [0.45, 0.5, 0.7, 0.75], [0, 1, 1, 0]);
  const w3 = useTransform(progress, [0.7, 0.75, 1], [0, 1, 1]);
  
  const w0y = useTransform(progress, [0.2, 0.25], [0, -20]);
  const w1y = useTransform(progress, [0.2, 0.25, 0.45, 0.5], [20, 0, 0, -20]);
  const w2y = useTransform(progress, [0.45, 0.5, 0.7, 0.75], [20, 0, 0, -20]);
  const w3y = useTransform(progress, [0.7, 0.75], [20, 0]);

  // Dot Indicators
  const d0 = useTransform(progress, [0, 0.1], [1, 1]);
  const d1 = useTransform(progress, [0.25, 0.3], [0, 1]);
  const d2 = useTransform(progress, [0.5, 0.55], [0, 1]);
  const d3 = useTransform(progress, [0.75, 0.8], [0, 1]);

  // 1. House (0.05 to 0.15)
  const hRow1 = useTransform(progress, [0.03, 0.05], [0, 1]);
  const hRow2 = useTransform(progress, [0.06, 0.08], [0, 1]);
  const hRow3 = useTransform(progress, [0.09, 0.11], [0, 1]);
  const hRow4 = useTransform(progress, [0.12, 0.14], [0, 1]);
  const hDoor = useTransform(progress, [0.15, 0.17], [0, 1]);
  
  const roofY = useTransform(progress, [0.17, 0.23], [0, 80]);
  
  // 2. Neighborhood (0.28 to 0.40)
  const mosque = useTransform(progress, [0.28, 0.32], [0, 1]);
  const mosqueY = useTransform(progress, [0.28, 0.32], [30, 0]);
  const tree1 = useTransform(progress, [0.32, 0.36], [0, 1]);
  const house2 = useTransform(progress, [0.35, 0.39], [0, 1]);
  const house2Y = useTransform(progress, [0.35, 0.39], [30, 0]);
  const tree2 = useTransform(progress, [0.38, 0.42], [0, 1]);

  // 3. City (0.52 to 0.65)
  const kingdom = useTransform(progress, [0.52, 0.58], [0, 1]);
  const kingdomY = useTransform(progress, [0.52, 0.58], [50, 0]);
  const mukaab = useTransform(progress, [0.58, 0.64], [0, 1]);
  const mukaabY = useTransform(progress, [0.58, 0.64], [50, 0]);
  const metroX = useTransform(progress, [0.60, 0.72], [-100, 1100]);
  
  // 4. Homeland (0.78 to 0.90)
  const flag = useTransform(progress, [0.78, 0.82], [0, 1]);
  const flagY = useTransform(progress, [0.78, 0.82], [30, 0]);
  
  const fw1 = useTransform(progress, [0.82, 0.86], [0, 1]);
  const fw1Scale = useTransform(progress, [0.82, 0.86], [0.5, 1]);
  const fw2 = useTransform(progress, [0.86, 0.90], [0, 1]);
  const fw2Scale = useTransform(progress, [0.86, 0.90], [0.5, 1]);

  const starsOpacity = useTransform(progress, [0.75, 0.85], [0.15, 0.8]);

  return (
    <div ref={containerRef} className="relative h-[500vh] w-full" id="story">
      <div className="sticky top-0 h-[100dvh] w-full overflow-hidden bg-gradient-to-b from-[#030914] via-[#08152e] to-[#040c1c]">
        <div className="absolute inset-0 bg-grid-pattern opacity-30" />
        
        <div className="absolute top-[8vh] left-0 w-full flex justify-center pointer-events-none z-10 px-4 text-center">
          <StageWord style={{ opacity: w0, y: w0y }} color="text-destructive" ar="بيتي" en="MY HOME · TERM 1" />
          <StageWord style={{ opacity: w1, y: w1y }} color="text-primary" ar="حيّي" en="MY NEIGHBORHOOD · TERM 2" />
          <StageWord style={{ opacity: w2, y: w2y }} color="text-accent" ar="مدينتي" en="MY CITY · TERM 3" />
          <StageWord style={{ opacity: w3, y: w3y }} color="text-[#00B140]" ar="وطننا" en="OUR HOMELAND · 23 SEP" />
        </div>

        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[min(1100px,110vw)] min-w-[800px] pointer-events-none">
          <svg viewBox="0 0 1100 560" className="w-full h-auto block overflow-visible">
            
            {/* Stars */}
            <motion.g style={{ opacity: starsOpacity }} className="text-secondary fill-current">
              <circle cx="120" cy="70" r="4"/><circle cx="300" cy="120" r="3" fill="#fff"/>
              <circle cx="900" cy="80" r="4"/><circle cx="760" cy="50" r="3" fill="#fff"/>
              <path d="M200 40l6 13 13 6-13 6-6 13-6-13-13-6 13-6z" />
              <path d="M980 150l5 11 11 5-11 5-5 11-5-11-11-5 11-5z" fill="#fff"/>
            </motion.g>

            {/* Ground */}
            <rect x="0" y="500" width="1100" height="60" className="fill-card"/>
            <line x1="0" y1="500" x2="1100" y2="500" stroke="currentColor" className="text-accent opacity-30" strokeWidth="2" strokeDasharray="12 9" />

            {/* Crane */}
            <g stroke="currentColor" className="text-secondary opacity-80" strokeWidth="6" fill="none" strokeLinecap="round" strokeLinejoin="round">
              <line x1="700" y1="500" x2="700" y2="120"/>
              <line x1="700" y1="120" x2="470" y2="120"/>
              <line x1="700" y1="120" x2="800" y2="120"/>
              <line x1="700" y1="80" x2="700" y2="120"/>
              <line x1="700" y1="80" x2="510" y2="120"/>
              <line x1="700" y1="80" x2="782" y2="120"/>
            </g>

            {/* House */}
            <g stroke="#030914" strokeWidth="5" strokeLinejoin="round">
              <motion.rect style={{ opacity: hRow1 }} x="440" y="440" width="160" height="30" className="fill-secondary" />
              <motion.rect style={{ opacity: hRow2 }} x="440" y="410" width="160" height="30" className="fill-secondary" />
              <motion.rect style={{ opacity: hRow3 }} x="440" y="380" width="160" height="30" className="fill-secondary" />
              <motion.rect style={{ opacity: hRow4 }} x="440" y="350" width="160" height="30" className="fill-secondary" />
              <motion.g style={{ opacity: hDoor }}>
                <rect x="498" y="414" width="44" height="56" rx="4" className="fill-accent" />
                <circle cx="534" cy="442" r="4" className="fill-secondary" stroke="none"/>
                <rect x="454" y="362" width="32" height="28" rx="4" className="fill-primary" />
                <rect x="554" y="362" width="32" height="28" rx="4" className="fill-primary" />
              </motion.g>
            </g>

            {/* Roof Rig */}
            <motion.g style={{ y: roofY }}>
              <line x1="520" y1="120" x2="520" y2="200" stroke="#fff" strokeWidth="3" opacity="0.3"/>
              <g transform="translate(520,226)">
                <path d="M-92 26 L0 -32 L92 26 Z" className="fill-destructive" stroke="#030914" strokeWidth="6" strokeLinejoin="round"/>
                <circle cx="0" cy="-36" r="6" className="fill-white" stroke="none"/>
              </g>
            </motion.g>

            {/* Neighborhood */}
            <g stroke="#030914" strokeWidth="5" strokeLinejoin="round">
              <motion.g style={{ opacity: mosque, y: mosqueY }}>
                <rect x="250" y="410" width="120" height="60" fill="#F1F4FB"/>
                <path d="M258 410 Q310 356 362 410 Z" className="fill-[#00B140]"/>
                <line x1="236" y1="470" x2="236" y2="360" strokeWidth="7"/>
                <circle cx="236" cy="352" r="9" className="fill-secondary" stroke="none"/>
                <rect x="292" y="430" width="34" height="40" rx="16" fill="#0D2B6B"/>
              </motion.g>
              <motion.g style={{ opacity: house2, y: house2Y }}>
                <rect x="660" y="424" width="110" height="46" className="fill-[#00B140]"/>
                <path d="M652 424 L715 386 L778 424 Z" className="fill-destructive"/>
                <rect x="698" y="440" width="30" height="30" rx="4" className="fill-accent"/>
              </motion.g>
              <motion.g style={{ opacity: tree1 }}>
                <line x1="400" y1="470" x2="400" y2="440" strokeWidth="7"/>
                <circle cx="400" cy="424" r="22" className="fill-[#00B140]"/>
              </motion.g>
              <motion.g style={{ opacity: tree2 }}>
                <line x1="812" y1="470" x2="812" y2="444" strokeWidth="7"/>
                <circle cx="812" cy="430" r="18" className="fill-[#00B140]"/>
              </motion.g>
            </g>

            {/* City */}
            <motion.g style={{ opacity: kingdom, y: kingdomY }}>
              <path d="M60 500 L60 300 Q60 220 118 220 Q176 220 176 300 L176 500 Z" fill="#1e3a8a"/>
              <path d="M82 500 L82 322 Q82 264 118 264 Q154 264 154 322 L154 500 Z" fill="#172554"/>
              <rect x="106" y="230" width="24" height="18" className="fill-accent" opacity=".85"/>
            </motion.g>
            <motion.g style={{ opacity: mukaab, y: mukaabY }}>
              <rect x="880" y="300" width="190" height="200" fill="#1e3a8a" stroke="#3b82f6" strokeWidth="3"/>
              <g stroke="#3b82f6" strokeWidth="2" opacity=".85">
                <line x1="880" y1="350" x2="1070" y2="350"/><line x1="880" y1="400" x2="1070" y2="400"/><line x1="880" y1="450" x2="1070" y2="450"/>
                <line x1="928" y1="300" x2="928" y2="500"/><line x1="976" y1="300" x2="976" y2="500"/><line x1="1024" y1="300" x2="1024" y2="500"/>
              </g>
              <rect x="958" y="386" width="28" height="28" className="fill-secondary" opacity=".9"/>
            </motion.g>
            <motion.g style={{ x: metroX }}>
              <rect x="0" y="486" width="120" height="20" rx="10" className="fill-accent"/>
              <rect x="14" y="490" width="18" height="9" rx="2" fill="#030914"/>
              <rect x="38" y="490" width="18" height="9" rx="2" fill="#030914"/>
              <rect x="62" y="490" width="18" height="9" rx="2" fill="#030914"/>
              <rect x="86" y="490" width="18" height="9" rx="2" fill="#030914"/>
            </motion.g>

            {/* Homeland */}
            <motion.g style={{ opacity: flag, y: flagY }}>
              <line x1="604" y1="328" x2="604" y2="220" stroke="#030914" strokeWidth="6"/>
              <path d="M604 220 L670 236 L604 252 Z" className="fill-[#00B140]" stroke="#030914" strokeWidth="4"/>
            </motion.g>

            <motion.g style={{ opacity: fw1, scale: fw1Scale, transformOrigin: '330px 180px' }} stroke="currentColor" className="text-secondary" strokeWidth="4" strokeLinecap="round">
              <g transform="translate(330,180)">
                <line x1="0" y1="-30" x2="0" y2="-12"/><line x1="0" y1="12" x2="0" y2="30"/>
                <line x1="-30" y1="0" x2="-12" y2="0"/><line x1="12" y1="0" x2="30" y2="0"/>
                <line x1="-20" y1="-20" x2="-10" y2="-10"/><line x1="10" y1="10" x2="20" y2="20"/>
                <line x1="20" y1="-20" x2="10" y2="-10"/><line x1="-10" y1="10" x2="-20" y2="20"/>
              </g>
            </motion.g>
            <motion.g style={{ opacity: fw2, scale: fw2Scale, transformOrigin: '840px 160px' }} stroke="currentColor" className="text-[#00B140]" strokeWidth="4" strokeLinecap="round">
              <g transform="translate(840,160)">
                <line x1="0" y1="-26" x2="0" y2="-10"/><line x1="0" y1="10" x2="0" y2="26"/>
                <line x1="-26" y1="0" x2="-10" y2="0"/><line x1="10" y1="0" x2="26" y2="0"/>
                <line x1="-18" y1="-18" x2="-8" y2="-8"/><line x1="8" y1="8" x2="18" y2="18"/>
                <line x1="18" y1="-18" x2="8" y2="-8"/><line x1="-8" y1="8" x2="-18" y2="18"/>
              </g>
            </motion.g>

          </svg>
        </div>

        {/* Progress Rail (Left side for RTL layout) */}
        <div className="absolute left-6 top-1/2 -translate-y-1/2 flex flex-col gap-4 z-20 pointer-events-none">
          <Dot progress={d0} />
          <Dot progress={d1} />
          <Dot progress={d2} />
          <Dot progress={d3} />
        </div>
      </div>
    </div>
  );
}

function StageWord({ style, color, ar, en }: any) {
  return (
    <motion.div style={style} className="absolute flex flex-col items-center top-0">
      <h2 className={`text-4xl md:text-7xl font-black ${color} drop-shadow-xl`}>{ar}</h2>
      <span className="font-mono text-[10px] md:text-sm tracking-[0.3em] text-muted-foreground mt-2 md:mt-4 uppercase" style={{ direction: 'ltr' }}>{en}</span>
    </motion.div>
  );
}

function Dot({ progress }: { progress: any }) {
  const bg = useTransform(progress, [0, 1], ["rgba(255,255,255,0.2)", "hsl(var(--secondary))"]);
  const scale = useTransform(progress, [0, 1], [1, 1.3]);
  const shadow = useTransform(progress, [0, 1], ["none", "0 0 12px hsl(var(--secondary))"]);
  
  return (
    <motion.div 
      style={{ backgroundColor: bg, scale, boxShadow: shadow }} 
      className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full"
    />
  );
}
