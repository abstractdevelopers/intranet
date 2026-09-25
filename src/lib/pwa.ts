/**
 * PWA splash-screen definitions (portrait), shared by the icon generator
 * (scripts/generate-pwa-icons.ts) and the root layout's iOS startup images.
 *
 * Kept as pure data with no image dependencies so the layout can import it
 * without pulling `sharp` into the app bundle.
 *
 * `ratio` is the device pixel ratio Apple reports for that screen, which must
 * match the media query exactly or iOS ignores the splash image. Splash files
 * are rendered at 2x for every screen, so a 390x844 phone uses 780x1688.
 */
export const SPLASH_SCREENS: { width: number; height: number; ratio: number }[] = [
  { width: 320, height: 568, ratio: 2 }, // iPhone SE (1st gen)
  { width: 375, height: 667, ratio: 2 }, // iPhone 6/7/8, SE (2nd/3rd gen)
  { width: 375, height: 812, ratio: 3 }, // iPhone X/XS/11 Pro
  { width: 390, height: 844, ratio: 3 }, // iPhone 12/13/14
  { width: 393, height: 852, ratio: 3 }, // iPhone 14 Pro/15/16
  { width: 414, height: 896, ratio: 2 }, // iPhone XR/11
  { width: 414, height: 896, ratio: 3 }, // iPhone XS Max/11 Pro Max
  { width: 428, height: 926, ratio: 3 }, // iPhone 12/13 Pro Max
  { width: 430, height: 932, ratio: 3 }, // iPhone 14 Pro Max/15 Pro Max
  { width: 768, height: 1024, ratio: 2 }, // iPad Mini/Air
  { width: 834, height: 1194, ratio: 2 }, // iPad Pro 11"
  { width: 1024, height: 1366, ratio: 2 }, // iPad Pro 12.9"
];

/** Splash files are always rendered at 2x, so one file serves both ratios. */
const SPLASH_SCALE = 2;

export function splashFileName(width: number, height: number) {
  return `apple-splash-${width * SPLASH_SCALE}-${height * SPLASH_SCALE}.png`;
}

/**
 * Apple startup images keyed by device metrics. iOS only honours an entry when
 * its media query matches the device exactly, so every supported screen size
 * needs its own line.
 */
export const APPLE_SPLASH_IMAGES = SPLASH_SCREENS.map(({ width, height, ratio }) => ({
  url: `/splash/${splashFileName(width, height)}`,
  media: `(device-width: ${width}px) and (device-height: ${height}px) and (-webkit-device-pixel-ratio: ${ratio})`,
}));
