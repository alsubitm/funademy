import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const MILESTONES = [100, 75, 50, 25] as const;
type Milestone = (typeof MILESTONES)[number];

const STORAGE_KEY = 'watan-milestones-seen';

const MESSAGES: Record<Milestone, { title: string; body: string; emoji: string }> = {
  25: {
    emoji: '🧱',
    title: 'ربع الجدار اكتمل!',
    body: 'عبرنا محطة ٢٥٪ — كل مكعّب وضعته عائلة تحب وطنها. شارك الرابط ليكبر الجدار!',
  },
  50: {
    emoji: '🎉',
    title: 'نصف الطريق نحو الهدف!',
    body: 'وصلنا ٥٠٪ من هدف الحملة — نصف جدار الوطن اكتمل بأيادي أطفالنا. لنكمل الباقي معاً!',
  },
  75: {
    emoji: '🚀',
    title: '٧٥٪ — اقتربنا جداً!',
    body: 'ثلاثة أرباع الجدار اكتملت! المحطة الأخيرة أمامنا — شارك الحملة مع من تحب.',
  },
  100: {
    emoji: '🏆',
    title: 'تحقّق الهدف — مبروك يا وطن!',
    body: 'اكتمل جدار الوطن بـ ١٠٠٪! شكراً لكل عائلة وضعت مكعّبها — نلقاكم في معرض وطن مصغّر بيوم الوطن.',
  },
};

function readSeen(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((n) => typeof n === 'number') : [];
  } catch {
    return [];
  }
}

function markSeen(milestone: Milestone) {
  try {
    const seen = readSeen();
    if (!seen.includes(milestone)) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...seen, milestone]));
    }
  } catch {
    // localStorage unavailable — celebration just won't be deduplicated
  }
}

const CONFETTI_COLORS = ['#FFC400', '#00B140', '#8E5CD9', '#1E90FF', '#FF5252', '#FFFFFF'];

function ConfettiBurst() {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        delay: Math.random() * 0.6,
        duration: 2.2 + Math.random() * 1.6,
        size: 6 + Math.random() * 8,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotate: Math.random() * 720 - 360,
        drift: Math.random() * 80 - 40,
      })),
    []
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden" aria-hidden>
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          initial={{ y: '-10vh', x: 0, opacity: 1, rotate: 0 }}
          animate={{ y: '110vh', x: p.drift, opacity: [1, 1, 0.9, 0], rotate: p.rotate }}
          transition={{ duration: p.duration, delay: p.delay, ease: 'easeIn' }}
          style={{
            position: 'absolute',
            top: 0,
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.45,
            backgroundColor: p.color,
            borderRadius: 2,
          }}
        />
      ))}
    </div>
  );
}

export function MilestoneCelebration({ progressPercent }: { progressPercent: number | null }) {
  const [active, setActive] = useState<Milestone | null>(null);

  useEffect(() => {
    if (progressPercent === null || active !== null) return;
    const seen = readSeen();
    // Highest crossed milestone the visitor hasn't seen yet
    const milestone = MILESTONES.find((m) => progressPercent >= m && !seen.includes(m));
    if (milestone) {
      markSeen(milestone);
      setActive(milestone);
    }
  }, [progressPercent, active]);

  const dismiss = () => setActive(null);

  return (
    <AnimatePresence>
      {active !== null && (
        <>
          <ConfettiBurst />
          <motion.div
            key="milestone-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[91] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={dismiss}
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label={MESSAGES[active].title}
          >
            <motion.div
              initial={{ scale: 0.8, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.85, y: 20, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 20 }}
              className="max-w-md w-full rounded-2xl border border-secondary/30 bg-card p-8 text-center shadow-2xl shadow-secondary/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-6xl mb-4">{MESSAGES[active].emoji}</div>
              <h3 className="text-2xl md:text-3xl font-black text-secondary mb-3">
                {MESSAGES[active].title}
              </h3>
              <p className="text-muted-foreground leading-relaxed mb-6">
                {MESSAGES[active].body}
              </p>
              <button
                type="button"
                onClick={dismiss}
                className="w-full rounded-xl bg-secondary px-6 py-3 font-bold text-secondary-foreground hover:opacity-90 transition-opacity"
              >
                نكمل البناء 🧱
              </button>
            </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
