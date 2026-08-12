/**
 * Rasterizes the WiviFit W (scripts/brand-mark.ts) into every launcher and
 * splash asset the app config references.
 *
 * Usage:
 *   npx tsx scripts/build-brand-assets.ts
 *
 * Re-runnable: it overwrites its outputs from the geometry every time, so the
 * mark is never hand-edited in an image editor and then lost. The one asset it
 * does not produce is assets/expo.icon/ — that's Apple's Icon Composer bundle,
 * which takes the W as an SVG layer instead of a bitmap.
 */
import { PNG } from 'pngjs';
import { writeFileSync } from 'node:fs';
import path from 'node:path';

import {
  ASCENDING,
  coverage,
  DESCENDING,
  MARK_HEIGHT,
  MARK_WIDTH,
  STROKE_WIDTH,
  type Segment,
} from './brand-mark';
import { REPO_ROOT } from './dataset';

const IMAGES_DIR = path.join(REPO_ROOT, 'assets', 'images');
const ICON_ASSETS_DIR = path.join(REPO_ROOT, 'assets', 'expo.icon', 'Assets');

/** Colors.dark.background — the same navy the splash and theme use. */
const NAVY = { r: 0x0b, g: 0x13, b: 0x2b };
/** Colors.dark.text. */
const FOREGROUND = { r: 0xec, g: 0xf1, b: 0xf7 };
/** Colors.dark.accent. */
const ACCENT = { r: 0x00, g: 0xd0, b: 0x84 };

interface Rgb {
  r: number;
  g: number;
  b: number;
}

interface AssetSpec {
  file: string;
  size: number;
  /** Fraction of the canvas width the mark spans. */
  markScale: number;
  background: Rgb | null;
  foreground: Rgb;
  /** Omit to draw the closing stroke in `foreground` too (monochrome assets). */
  accent?: Rgb;
}

const ASSETS: AssetSpec[] = [
  // Paired with `imageWidth: 76` on the expo-splash-screen plugin, which scales
  // this down — so it ships at 4x for density. Transparent: the plugin paints
  // the navy field itself.
  { file: 'splash-icon.png', size: 304, markScale: 1, background: null, foreground: FOREGROUND, accent: ACCENT },

  // Full-bleed app icon. Stores composite their own rounded mask over it.
  { file: 'icon.png', size: 1024, markScale: 0.56, background: NAVY, foreground: FOREGROUND, accent: ACCENT },

  // Android adaptive foreground: the launcher crops to a shape that can eat the
  // outer third, so the mark stays well inside the 66% safe zone.
  { file: 'android-icon-foreground.png', size: 1024, markScale: 0.44, background: null, foreground: FOREGROUND, accent: ACCENT },

  // Themed icons are recoloured wholesale by the launcher, so the accent would
  // be flattened anyway — drawn in one tone on purpose.
  { file: 'android-icon-monochrome.png', size: 1024, markScale: 0.44, background: null, foreground: { r: 255, g: 255, b: 255 } },

  { file: 'favicon.png', size: 64, markScale: 0.62, background: NAVY, foreground: FOREGROUND, accent: ACCENT },
];

/** Flat navy behind the adaptive foreground, per app.json's adaptiveIcon. */
const BACKGROUND_ASSET = { file: 'android-icon-background.png', size: 1024, color: NAVY };

function render(spec: AssetSpec): PNG {
  const png = new PNG({ width: spec.size, height: spec.size });

  // Map the canvas onto the mark's authoring box, centred.
  const scale = (spec.size * spec.markScale) / MARK_WIDTH;
  const offsetX = (spec.size - MARK_WIDTH * scale) / 2;
  const offsetY = (spec.size - MARK_HEIGHT * scale) / 2;

  for (let y = 0; y < spec.size; y++) {
    for (let x = 0; x < spec.size; x++) {
      // Sample at the pixel centre, in mark-box coordinates.
      const mx = (x + 0.5 - offsetX) / scale;
      const my = (y + 0.5 - offsetY) / scale;

      const descending = coverage(mx, my, DESCENDING, scale);
      const ascending = spec.accent ? coverage(mx, my, ASCENDING, scale) : 0;
      const mono = spec.accent ? 0 : coverage(mx, my, [...DESCENDING, ...ASCENDING], scale);

      let r: number;
      let g: number;
      let b: number;
      let alpha: number;

      if (spec.background) {
        r = spec.background.r;
        g = spec.background.g;
        b = spec.background.b;
        alpha = 1;
      } else {
        r = spec.foreground.r;
        g = spec.foreground.g;
        b = spec.foreground.b;
        alpha = 0;
      }

      // Foreground strokes, then the accent on top so the shared vertex at the
      // bottom-right valley reads as the rising stroke starting there.
      const layers: { color: Rgb; alpha: number }[] = spec.accent
        ? [
            { color: spec.foreground, alpha: descending },
            { color: spec.accent, alpha: ascending },
          ]
        : [{ color: spec.foreground, alpha: mono }];

      for (const layer of layers) {
        if (layer.alpha <= 0) continue;
        const out = layer.alpha + alpha * (1 - layer.alpha);
        r = (layer.color.r * layer.alpha + r * alpha * (1 - layer.alpha)) / out;
        g = (layer.color.g * layer.alpha + g * alpha * (1 - layer.alpha)) / out;
        b = (layer.color.b * layer.alpha + b * alpha * (1 - layer.alpha)) / out;
        alpha = out;
      }

      const i = (y * spec.size + x) << 2;
      png.data[i] = Math.round(r);
      png.data[i + 1] = Math.round(g);
      png.data[i + 2] = Math.round(b);
      png.data[i + 3] = Math.round(alpha * 255);
    }
  }

  return png;
}

function renderFlat(size: number, color: Rgb): PNG {
  const png = new PNG({ width: size, height: size });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = color.r;
    png.data[i + 1] = color.g;
    png.data[i + 2] = color.b;
    png.data[i + 3] = 255;
  }
  return png;
}

/**
 * A round-capped stroke as a filled outline.
 *
 * Icon Composer only reliably renders filled paths, so the segment is emitted
 * as a stadium: two parallel edges closed by a half-circle at each end. Because
 * the strokes share their endpoints and the caps are round, the union of the
 * four stadiums is exactly the stroked mark — and nonzero fill unions the
 * overlaps for free.
 */
function stadiumPath(s: Segment, radius: number): string {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const length = Math.hypot(dx, dy);
  // Left-hand normal, scaled to the stroke's half-width.
  const nx = (-dy / length) * radius;
  const ny = (dx / length) * radius;

  const round = (n: number) => Number(n.toFixed(3));
  const arc = `A ${radius} ${radius} 0 0 0`;

  return [
    `M ${round(s.x1 + nx)} ${round(s.y1 + ny)}`,
    `L ${round(s.x2 + nx)} ${round(s.y2 + ny)}`,
    `${arc} ${round(s.x2 - nx)} ${round(s.y2 - ny)}`,
    `L ${round(s.x1 - nx)} ${round(s.y1 - ny)}`,
    `${arc} ${round(s.x1 + nx)} ${round(s.y1 + ny)}`,
    'Z',
  ].join(' ');
}

function toHex({ r, g, b }: Rgb): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/**
 * Icon Composer lays layers out at the SVG's intrinsic size, so this is emitted
 * at roughly the footprint of the Expo symbol it replaces — at the authoring
 * box's 100x64 the mark would land in the middle of the canvas as a speck.
 */
const ICON_LAYER_WIDTH = 600;

function renderSvg(): string {
  const group = (segments: Segment[], color: Rgb) =>
    segments
      .map((s) => `  <path d="${stadiumPath(s, STROKE_WIDTH / 2)}" fill="${toHex(color)}"/>`)
      .join('\n');

  const height = Math.round((ICON_LAYER_WIDTH * MARK_HEIGHT) / MARK_WIDTH);

  return [
    `<svg width="${ICON_LAYER_WIDTH}" height="${height}" viewBox="0 0 ${MARK_WIDTH} ${MARK_HEIGHT}" fill="none" xmlns="http://www.w3.org/2000/svg">`,
    group(DESCENDING, FOREGROUND),
    group(ASCENDING, ACCENT),
    '</svg>',
    '',
  ].join('\n');
}

function write(png: PNG, file: string) {
  const outPath = path.join(IMAGES_DIR, file);
  writeFileSync(outPath, PNG.sync.write(png));
  console.log(`  ${file}  ${png.width}x${png.height}`);
}

function main() {
  console.log('Rendering brand assets from scripts/brand-mark.ts');
  for (const spec of ASSETS) {
    write(render(spec), spec.file);
  }
  write(renderFlat(BACKGROUND_ASSET.size, BACKGROUND_ASSET.color), BACKGROUND_ASSET.file);

  const svg = renderSvg();
  writeFileSync(path.join(ICON_ASSETS_DIR, 'wivifit-w.svg'), svg);
  console.log(`  expo.icon/Assets/wivifit-w.svg  ${svg.match(/width="(\d+)" height="(\d+)"/)?.slice(1, 3).join('x')}`);
  console.log('Done.');
}

main();
