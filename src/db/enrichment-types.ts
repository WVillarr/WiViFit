/**
 * Closed enums invented by the app's enrichment rules (Bloque D) — not present
 * in the source dataset. See scripts/build-catalog.ts.
 */
export const MOVEMENT_PATTERNS = [
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'knee_dominant',
  'hip_dominant',
  'core',
  'isolation',
] as const;
export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number];

export const TRACKING_TYPES = ['reps', 'time', 'distance'] as const;
export type TrackingType = (typeof TRACKING_TYPES)[number];

export type Difficulty = 1 | 2 | 3;
