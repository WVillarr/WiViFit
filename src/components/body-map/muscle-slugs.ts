import type { Slug } from 'react-native-body-highlighter';

/**
 * The plate comes from `react-native-body-highlighter`, whose slugs don't line
 * up 1:1 with the `target` values in our exercises catalog (see
 * src/db/catalog-schema.ts), so the two directions are mapped separately.
 */

/**
 * Catalog target -> plate slug, used to paint the current selection.
 *
 * `lats` and `abductors` have no slug of their own; they share the region that
 * anatomically contains them, so selecting either from the chip list still
 * lights up the right part of the body. `cardiovascular_system` has no body
 * location at all and is deliberately absent — the screen offers it as a chip.
 */
export const TARGET_TO_SLUG: Record<string, Slug> = {
  abs: 'abs',
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves',
  delts: 'deltoids',
  forearms: 'forearm',
  glutes: 'gluteal',
  hamstrings: 'hamstring',
  levator_scapulae: 'neck',
  pectorals: 'chest',
  quads: 'quadriceps',
  serratus_anterior: 'obliques',
  spine: 'lower-back',
  traps: 'trapezius',
  triceps: 'triceps',
  upper_back: 'upper-back',
  lats: 'upper-back',
  abductors: 'gluteal',
};

/**
 * Plate slug -> catalog target, used to turn a tap into a filter. Not the
 * inverse of the map above: the two shared regions resolve to the target with
 * more exercises behind it, and slugs with no exercises are simply absent so
 * tapping them does nothing.
 */
export const SLUG_TO_TARGET: Partial<Record<Slug, string>> = {
  abs: 'abs',
  adductors: 'adductors',
  biceps: 'biceps',
  calves: 'calves',
  chest: 'pectorals',
  deltoids: 'delts',
  forearm: 'forearms',
  gluteal: 'glutes',
  hamstring: 'hamstrings',
  'lower-back': 'spine',
  neck: 'levator_scapulae',
  obliques: 'serratus_anterior',
  quadriceps: 'quads',
  trapezius: 'traps',
  triceps: 'triceps',
  'upper-back': 'upper_back',
};

/** Parts that carry no muscle, drawn flat grey the way an anatomy plate does. */
export const INERT_SLUGS: Slug[] = ['head', 'hair', 'hands', 'feet'];

/**
 * Every slug the plate can draw. The component has to name all of them because
 * the library's asset data ships a baked-in `color: "#3f3f3f"` per part, and
 * `getColorToFill` prefers that over the `defaultFill` prop — only a per-part
 * `styles.fill` outranks it. Miss a slug and it renders dark grey.
 */
export const ALL_SLUGS: Slug[] = [
  'abs',
  'adductors',
  'ankles',
  'biceps',
  'calves',
  'chest',
  'deltoids',
  'feet',
  'forearm',
  'gluteal',
  'hair',
  'hamstring',
  'hands',
  'head',
  'knees',
  'lower-back',
  'neck',
  'obliques',
  'quadriceps',
  'tibialis',
  'trapezius',
  'triceps',
  'upper-back',
];
