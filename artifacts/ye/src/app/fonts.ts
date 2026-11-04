import localFont from 'next/font/local';

// Source fonts and their OFL licenses are bundled in src/fonts.
// Publishing must never require Google CSS/font downloads.
export const baloo = localFont({
  src: '../fonts/BalooBhaijaan2-Variable.ttf',
  weight: '400 800', display: 'swap', variable: '--font-baloo',
});
export const plexArabic = localFont({
  src: [
    { path: '../fonts/IBMPlexSansArabic-Light.ttf', weight: '300' },
    { path: '../fonts/IBMPlexSansArabic-Regular.ttf', weight: '400' },
    { path: '../fonts/IBMPlexSansArabic-Medium.ttf', weight: '500' },
    { path: '../fonts/IBMPlexSansArabic-SemiBold.ttf', weight: '600' },
    { path: '../fonts/IBMPlexSansArabic-Bold.ttf', weight: '700' },
  ],
  display: 'swap', variable: '--font-plex-arabic',
});
export const plexMono = localFont({
  src: [
    { path: '../fonts/IBMPlexMono-Regular.ttf', weight: '400' },
    { path: '../fonts/IBMPlexMono-Medium.ttf', weight: '500' },
    { path: '../fonts/IBMPlexMono-SemiBold.ttf', weight: '600' },
    { path: '../fonts/IBMPlexMono-Bold.ttf', weight: '700' },
  ],
  display: 'swap', variable: '--font-plex-mono',
});
export const spaceGrotesk = localFont({
  src: '../fonts/SpaceGrotesk-Variable.ttf',
  weight: '500 700', display: 'swap', variable: '--font-v3-display',
});
export const manrope = localFont({
  src: '../fonts/Manrope-Variable.ttf',
  weight: '400 800', display: 'swap', variable: '--font-v3-body',
});
export const notoArabic = localFont({
  src: '../fonts/NotoSansArabic-Variable.ttf',
  weight: '400 900', display: 'swap', variable: '--font-v3-arabic',
});
