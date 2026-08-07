'use client';

/**
 * Kite-Cap flip mark — hover (or tap) and the kite lands, becoming the cap.
 * Animation replicated from the Funademy Kite-Cap identity file.
 */
export function FlipMark({ size = 44, className = '' }: { size?: number; className?: string }) {
  return (
    <span
      className={`flipmark ${className}`}
      style={{ width: size, height: size }}
      onClick={(e) => e.currentTarget.classList.toggle('on')}
      aria-hidden="true"
    >
      {/* kite view */}
      <svg className="kiteV" viewBox="0 0 260 260">
        <path d="M130 226 Q 158 246 152 256" fill="none" stroke="#C98A1E" strokeWidth={6} strokeLinecap="round" />
        <g stroke="#101A38" strokeLinejoin="round">
          <polygon points="130,26 226,126 130,226 34,126" fill="#FFC400" strokeWidth={9} />
          <line x1={130} y1={26} x2={130} y2={226} strokeWidth={5} />
          <line x1={34} y1={126} x2={226} y2={126} strokeWidth={5} />
          <circle cx={130} cy={126} r={13} fill="#0D2B6B" strokeWidth={6} />
        </g>
      </svg>
      {/* cap view */}
      <svg className="capV" viewBox="0 0 260 260">
        <g stroke="#101A38" strokeLinejoin="round">
          <polygon points="130,60 240,116 130,172 20,116" fill="#FFC400" strokeWidth={9} />
          <line x1={130} y1={60} x2={130} y2={172} strokeWidth={5} opacity={0.5} />
          <line x1={20} y1={116} x2={240} y2={116} strokeWidth={5} opacity={0.5} />
          <path d="M78 152 L78 196 Q130 224 182 196 L182 152" fill="#FFC400" strokeWidth={9} />
          <circle cx={130} cy={116} r={12} fill="#0D2B6B" strokeWidth={6} />
          <path d="M130 116 Q 196 130 200 178" fill="none" stroke="#C98A1E" strokeWidth={6} strokeLinecap="round" />
          <path d="M200 178 l5 11 11 5 -11 5 -5 11 -5 -11 -11 -5 11 -5z" fill="#FFC400" stroke="#101A38" strokeWidth={4} />
        </g>
      </svg>
    </span>
  );
}
