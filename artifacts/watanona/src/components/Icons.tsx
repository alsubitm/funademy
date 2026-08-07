export function BrickIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 14L16 8L28 14V22L16 28L4 22V14Z" fill="currentColor" opacity="0.8"/>
      <path d="M16 8L28 14L16 20L4 14L16 8Z" fill="currentColor" opacity="0.6"/>
      <path d="M4 14L16 20V28L4 22V14Z" fill="currentColor" opacity="0.4"/>
      <circle cx="10" cy="11.5" r="2.5" fill="currentColor" opacity="0.9"/>
      <circle cx="16" cy="14.5" r="2.5" fill="currentColor" opacity="0.9"/>
      <circle cx="16" cy="8.5" r="2.5" fill="currentColor" opacity="0.9"/>
      <circle cx="22" cy="11.5" r="2.5" fill="currentColor" opacity="0.9"/>
    </svg>
  );
}
