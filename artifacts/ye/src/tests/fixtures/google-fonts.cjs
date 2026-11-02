/**
 * next/font's supported test hook for the isolated DB-resilience build.
 * These are build-only font bytes, never browser assets or production fonts.
 * Explicit URL keys intentionally fail closed if layout font requests change.
 */
const families = [
  ['Baloo Bhaijaan 2', [400, 500, 600, 700, 800]],
  ['IBM Plex Sans Arabic', [300, 400, 500, 600, 700]],
  ['IBM Plex Mono', [400, 500, 600, 700]],
  ['Space Grotesk', [500, 600, 700]],
  ['Manrope', [400, 500, 600, 700, 800]],
  ['Noto Sans Arabic', [400, 500, 600, 700, 800, 900]],
];

module.exports = Object.fromEntries(families.map(([family, weights]) => [
  `https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}:wght@${weights.join(';')}&display=swap`,
  weights.map(weight => `/* latin */
@font-face {
  font-family: '${family}';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(https://font-fixture.invalid/${family.replaceAll(' ', '-')}-${weight}.woff2) format('woff2');
}`).join('\n'),
]));
