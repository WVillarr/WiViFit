/**
 * The catalog's 28 `equipment` values, folded into the six answers a user can
 * actually give about what they have access to.
 *
 * Filtering by the raw values would mean a 28-chip row where "olympic_barbell",
 * "trap_bar" and "barbell" are three separate questions — nobody picks between
 * those, they pick "I have a barbell". The groups are what a gym bag or a home
 * corner looks like, not what the dataset happens to distinguish.
 *
 * Every value belongs to exactly one group; the union is the whole catalog.
 * scripts/catalog.test.ts holds that invariant.
 */
export const EQUIPMENT_GROUPS = {
  body_weight: ['body_weight'],
  free_weights: ['dumbbell', 'kettlebell', 'weighted', 'medicine_ball'],
  barbell: ['barbell', 'ez_barbell', 'olympic_barbell', 'trap_bar'],
  machine: [
    'cable',
    'leverage_machine',
    'smith_machine',
    'assisted',
    'sled_machine',
    'hammer',
    'elliptical_machine',
    'stationary_bike',
    'stepmill_machine',
    'skierg_machine',
    'upper_body_ergometer',
  ],
  band: ['band', 'resistance_band'],
  accessory: ['stability_ball', 'rope', 'roller', 'bosu_ball', 'wheel_roller', 'tire'],
} as const;

export type EquipmentGroup = keyof typeof EQUIPMENT_GROUPS;

/** Ordered by how many exercises each covers, so the useful ones come first. */
export const EQUIPMENT_GROUP_ORDER: EquipmentGroup[] = [
  'body_weight',
  'free_weights',
  'machine',
  'barbell',
  'band',
  'accessory',
];

/** The raw `equipment` values behind a set of groups, for the `IN (…)` clause. */
export function equipmentValuesFor(groups: EquipmentGroup[]): string[] {
  return groups.flatMap((group) => [...EQUIPMENT_GROUPS[group]]);
}
