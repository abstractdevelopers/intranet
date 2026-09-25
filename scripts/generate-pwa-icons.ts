/**
 * Generates the PWA icon set and iOS splash screens from the white UCA
 * monogram. Icons are placed on the brand purple so they read on light and
 * dark launchers, and a maskable variant keeps the mark inside Android's safe
 * zone. Splash screens use the same deep-purple gradient as `.hero-band`, with
 * the mark centred, so an installed app opens on brand.
 *
 * Run with:
 *   npx tsx scripts/generate-pwa-icons.ts
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";
import path from "node:path";
import { SPLASH_SCREENS, splashFileName } from "../src/lib/pwa";

const SOURCE = path.join(process.cwd(), "public", "uca-logo.png");
const ICON_DIR = path.join(process.cwd(), "public", "icons");
const SPLASH_DIR = path.join(process.cwd(), "public", "splash");
const BRAND = "#570e83";

/** Mark occupies this fraction of the canvas; the rest is padding. */
const MARK_RATIO = 0.66;
const MASKABLE_RATIO = 0.5;
/** Splash screens are quieter than icons — a third of the width. */
const SPLASH_MARK_RATIO = 0.32;
/** Splash files are rendered at 2x so one file serves every pixel ratio. */
const SPLASH_SCALE = 2;

/** Portrait splash sizes that cover current iPhones and iPads. */
export const SPLASH_SIZES = SPLASH_SCREENS;

function brandBackground(width: number, height: number) {
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#570e83"/>
          <stop offset="0.55" stop-color="#410b61"/>
          <stop offset="1" stop-color="#2d0745"/>
        </linearGradient>
        <radialGradient id="r" cx="0.85" cy="-0.05" r="0.65">
          <stop offset="0" stop-color="#e6a9ff" stop-opacity="0.22"/>
          <stop offset="1" stop-color="#e6a9ff" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#g)"/>
      <rect width="${width}" height="${height}" fill="url(#r)"/>
    </svg>`
  );
}

async function icon(size: number, ratio: number, file: string) {
  const markWidth = Math.round(size * ratio);
  const mark = await sharp(SOURCE).resize({ width: markWidth }).toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BRAND,
    },
  })
    .composite([{ input: mark, gravity: "center" }])
    .png()
    .toFile(path.join(ICON_DIR, file));
}

async function splash(width: number, height: number) {
  const w = width * SPLASH_SCALE;
  const h = height * SPLASH_SCALE;
  const mark = await sharp(SOURCE)
    .resize({ width: Math.round(w * SPLASH_MARK_RATIO) })
    .toBuffer();

  await sharp(brandBackground(w, h))
    .composite([{ input: mark, gravity: "center" }])
    // Flat brand gradients quantise well; dithering would add noise (and
    // bytes) without visible benefit at splash scale.
    .png({ palette: true, colours: 64, dither: 0, compressionLevel: 9, effort: 8 })
    .toFile(path.join(SPLASH_DIR, splashFileName(width, height)));
}

async function main() {
  mkdirSync(ICON_DIR, { recursive: true });
  mkdirSync(SPLASH_DIR, { recursive: true });

  await Promise.all([
    icon(192, MARK_RATIO, "icon-192.png"),
    icon(512, MARK_RATIO, "icon-512.png"),
    icon(512, MASKABLE_RATIO, "icon-maskable-512.png"),
    icon(180, MARK_RATIO, "apple-touch-icon.png"),
    ...SPLASH_SCREENS.map((s) => splash(s.width, s.height)),
  ]);

  console.log("PWA icons written to public/icons");
  console.log(`${SPLASH_SCREENS.length} splash screens written to public/splash`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
