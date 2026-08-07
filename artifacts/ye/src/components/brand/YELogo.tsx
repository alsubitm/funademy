/**
 * e² Young Engineers official logo.
 * Renders public/brand/ye-logo.svg via <img> so the SVG file
 * can be swapped by the owner without touching code.
 */

type YELogoProps = {
  /** Height in px (width scales automatically). Default: 36 */
  height?: number;
  /** Apply light/white filter for dark backgrounds */
  onDark?: boolean;
  className?: string;
};

export function YELogo({ height = 36, onDark = false, className }: YELogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand/ye-logo.svg"
      alt="e² Young Engineers"
      height={height}
      style={{
        height,
        width: 'auto',
        display: 'block',
        filter: onDark ? 'brightness(0) invert(1)' : undefined,
      }}
      className={className}
    />
  );
}
