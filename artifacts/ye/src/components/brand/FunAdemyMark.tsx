/**
 * FunAdemy "Kite-Cap" identity marks (Master Spec, Aug 2026).
 * One golden diamond, two truths: a flying kite for kids/marketing,
 * a graduation cap seen from above for certificates/official use.
 */

type MarkProps = { size?: number; className?: string };

/** Primary mark — the flying kite (full: tail + bows + star; omitted at small sizes). */
export function KiteMark({ size = 84, className, dark = false, full = true }: MarkProps & { dark?: boolean; full?: boolean }) {
  const stroke = dark ? '#F5F8FF' : '#101A38';
  const tail = dark ? '#F2CD7E' : '#E5AE4A';
  return (
    <svg viewBox="0 0 340 420" width={size} className={className} aria-hidden="true">
      {full && (
        <>
          <path d="M170 316 Q 214 356 200 392 Q 190 416 226 414" fill="none" stroke={tail} strokeWidth={7} strokeLinecap="round" />
          <g stroke={stroke} strokeWidth={5} strokeLinejoin="round">
            <rect x={196} y={338} width={22} height={22} rx={5} fill="#22DAFF" transform="rotate(45 207 349)" />
            <rect x={186} y={378} width={20} height={20} rx={5} fill="#F2CD7E" transform="rotate(45 196 388)" />
          </g>
          <path d="M240 402 l7 15 15 7 -15 7 -7 15 -7 -15 -15 -7 15 -7z" fill="#FFCA17" stroke={stroke} strokeWidth={5} />
        </>
      )}
      {!full && (
        <path d="M170 316 Q 214 356 200 392" fill="none" stroke={tail} strokeWidth={9} strokeLinecap="round" />
      )}
      <g stroke={stroke} strokeLinejoin="round">
        <polygon points="170,36 306,176 170,316 34,176" fill="#FFCA17" strokeWidth={full ? 10 : 12} />
        <line x1={170} y1={36} x2={170} y2={316} strokeWidth={6} />
        <line x1={34} y1={176} x2={306} y2={176} strokeWidth={6} />
        {!dark && <polygon points="170,36 306,176 170,176" fill="#FFE066" stroke="none" opacity={0.5} />}
        <circle cx={170} cy={176} r={16} fill="#1C54CB" strokeWidth={7} />
      </g>
    </svg>
  );
}

/** Academic mode — the cap with band, tassel and star (certificates, official). */
export function CapMark({ size = 84, className }: MarkProps) {
  return (
    <svg viewBox="0 0 260 240" width={size} className={className} aria-hidden="true">
      <g stroke="#101A38" strokeLinejoin="round">
        <polygon points="130,44 246,104 130,164 14,104" fill="#FFCA17" strokeWidth={9} />
        <path d="M76 142 L76 188 Q130 216 184 188 L184 142" fill="#FFCA17" strokeWidth={9} />
        <circle cx={130} cy={104} r={12} fill="#1C54CB" strokeWidth={6} />
        <path d="M130 104 Q 198 118 202 168" fill="none" stroke="#E5AE4A" strokeWidth={6} strokeLinecap="round" />
        <path d="M202 168 l5.5 12 12 5.5 -12 5.5 -5.5 12 -5.5 -12 -12 -5.5 12 -5.5z" fill="#FFCA17" stroke="#101A38" strokeWidth={4.5} />
      </g>
    </svg>
  );
}

/** Wordmark — Fun**Ademy** two-tone: Fun in ink, Ademy in blue (overridable via CSS vars on dark). */
export function Wordmark({
  lang = 'ar',
  className,
  style,
}: {
  lang?: 'ar' | 'en';
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span
      className={className}
      style={{ fontFamily: "'Baloo Bhaijaan 2', sans-serif", fontWeight: 800, ...style }}
      dir="ltr"
    >
      <span style={{ color: 'var(--wm-fun, var(--ink, #101A38))' }}>Fun</span>
      <span style={{ color: 'var(--wm-ademy, var(--blue, #1C54CB))' }}>Ademy</span>
    </span>
  );
}
