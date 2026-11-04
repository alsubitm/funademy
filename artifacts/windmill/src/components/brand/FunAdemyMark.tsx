/** FunAdemy kite mark — artwork adapted from the YE site's KiteCapMark (kite view only, no framework imports). */
export function FunAdemyMark({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 260 260" aria-hidden="true" focusable="false">
      <path d="M130 226 Q 158 246 152 256" fill="none" stroke="#C98A1E" strokeWidth={6} strokeLinecap="round" />
      <g stroke="#101A38" strokeLinejoin="round">
        <polygon points="130,26 226,126 130,226 34,126" fill="#FFC400" strokeWidth={9} />
        <line x1={130} y1={26} x2={130} y2={226} strokeWidth={5} />
        <line x1={34} y1={126} x2={226} y2={126} strokeWidth={5} />
        <circle cx={130} cy={126} r={13} fill="#0D2B6B" strokeWidth={6} />
      </g>
    </svg>
  );
}

export function FunAdemyWordmark({ sub }: { sub: string }) {
  return (
    <span className="brand" dir="ltr">
      <FunAdemyMark size={40} />
      <span className="brand-text">
        <span className="brand-name">FunAdemy</span>
        <span className="brand-sub">{sub}</span>
      </span>
    </span>
  );
}
