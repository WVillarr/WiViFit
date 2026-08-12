/**
 * The dataset names secondary muscles with a different vocabulary than it names
 * primary ones.
 *
 * `exercises.target` uses 19 slugs (`delts`, `pectorals`, `quads`, `abs`);
 * `exercise_secondary_muscles.muscle` uses 40, mostly anatomical and finer
 * grained (`shoulders`, `chest`, `quadriceps`, `rhomboids`, `rotator_cuff`).
 * Nothing in the dataset relates the two, so the app has to.
 *
 * Without this map, secondary muscles rendered as `[missing translation]` for
 * over half of the 2,581 rows — `shoulders` alone appears on 400 — and the body
 * map silently highlighted nothing, since its slug table is keyed by `target`.
 *
 * Muscles finer than the plate can draw resolve to the region that contains
 * them: a rhomboid is drawn as upper back because there is no rhomboid path.
 * That's a deliberate loss on the drawing only — the label keeps the precise
 * name, which is the part that teaches.
 */
export const SECONDARY_TO_TARGET: Record<string, string | null> = {
  // Same muscle, different word
  abdominals: 'abs',
  chest: 'pectorals',
  core: 'abs',
  deltoids: 'delts',
  latissimus_dorsi: 'lats',
  lower_abs: 'abs',
  lower_back: 'spine',
  quadriceps: 'quads',
  rear_deltoids: 'delts',
  shoulders: 'delts',
  trapezius: 'traps',
  upper_chest: 'pectorals',
  back: 'upper_back',
  obliques: 'serratus_anterior',

  // Finer than the plate — drawn as the region that contains them
  brachialis: 'biceps',
  grip_muscles: 'forearms',
  groin: 'adductors',
  hip_flexors: 'quads',
  inner_thighs: 'adductors',
  rhomboids: 'upper_back',
  rotator_cuff: 'delts',
  soleus: 'calves',
  sternocleidomastoid: 'levator_scapulae',
  wrist_extensors: 'forearms',
  wrist_flexors: 'forearms',
  wrists: 'forearms',

  // No region on the plate at all
  ankle_stabilizers: null,
  ankles: null,
  feet: null,
  hands: null,
  shins: null,
};

/** Plate targets for a set of secondary muscles, dropping the undrawable ones. */
export function secondaryPlateTargets(muscles: string[]): string[] {
  return muscles
    .map((muscle) => (muscle in SECONDARY_TO_TARGET ? SECONDARY_TO_TARGET[muscle] : muscle))
    .filter((target): target is string => target != null);
}
