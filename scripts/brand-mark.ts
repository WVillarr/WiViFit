/**
 * The WiviFit W, as geometry.
 *
 * Single source of truth for the mark: src/components/wivifit-mark.tsx draws
 * these same segments with react-native-svg for in-app surfaces, and
 * scripts/build-brand-assets.ts rasterizes them for the launcher icons and the
 * native splash. Change the shape here and both follow.
 */

/** The box the segments are authored in. */
export const MARK_WIDTH = 100;
export const MARK_HEIGHT = 64;

export const STROKE_WIDTH = 14;

export interface Segment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** The three leading strokes — drawn in the foreground colour. */
export const DESCENDING: Segment[] = [
  { x1: 7, y1: 7, x2: 28, y2: 57 },
  { x1: 28, y1: 57, x2: 50, y2: 22 },
  { x1: 50, y1: 22, x2: 72, y2: 57 },
];

/** The closing stroke — the one that rises, drawn in the accent. */
export const ASCENDING: Segment[] = [{ x1: 72, y1: 57, x2: 93, y2: 7 }];

/** Shortest distance from a point to a segment, for the round-capped stroke. */
export function distanceToSegment(px: number, py: number, s: Segment): number {
  const dx = s.x2 - s.x1;
  const dy = s.y2 - s.y1;
  const lengthSquared = dx * dx + dy * dy;

  // Projection of the point onto the segment, clamped to its ends — clamping is
  // what turns the infinite line into a segment with round caps.
  const t = Math.max(0, Math.min(1, ((px - s.x1) * dx + (py - s.y1) * dy) / lengthSquared));

  const nearestX = s.x1 + t * dx;
  const nearestY = s.y1 + t * dy;
  return Math.hypot(px - nearestX, py - nearestY);
}

/**
 * How much of the pixel at (px, py) the stroke covers, in 0..1.
 *
 * The half-pixel feather either side of the stroke edge is the antialiasing:
 * without it the diagonals come out with visible stair steps.
 */
export function coverage(px: number, py: number, segments: Segment[], scale: number): number {
  let nearest = Infinity;
  for (const segment of segments) {
    nearest = Math.min(nearest, distanceToSegment(px, py, segment));
  }
  // The feather is expressed in output pixels, so it shrinks as the mark grows.
  const feather = 0.5 / scale;
  const edge = STROKE_WIDTH / 2;
  return Math.max(0, Math.min(1, (edge + feather - nearest) / (2 * feather)));
}
