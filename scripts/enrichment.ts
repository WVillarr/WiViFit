import type { Difficulty, MovementPattern, TrackingType } from '@/db/enrichment-types';

/** Raw (pre-slugify) dataset strings, e.g. target: "upper back", not "upper_back". */
export interface EnrichmentInput {
  name: string;
  target: string;
  equipment: string;
  bodyPart: string;
}

export interface EnrichmentResult {
  movementPattern: MovementPattern;
  movementPatternConfidence: number;
  compound: boolean;
  difficulty: Difficulty;
  trackingType: TrackingType;
  trackingTypeConfidence: number;
  avgSecondsPerRep: number | null;
}

const COMPOUND_PATTERNS: ReadonlySet<MovementPattern> = new Set([
  'horizontal_push',
  'vertical_push',
  'horizontal_pull',
  'vertical_pull',
  'knee_dominant',
  'hip_dominant',
]);

function includesAny(haystack: string, needles: readonly string[]): boolean {
  return needles.some((needle) => haystack.includes(needle));
}

/**
 * Classifies the dominant movement pattern from name + target muscle
 * keywords. Returns a confidence in [0, 1]: 1.0 for an unambiguous keyword
 * match, lower when falling back to a target-only guess.
 */
function classifyMovementPattern(input: EnrichmentInput): {
  pattern: MovementPattern;
  confidence: number;
} {
  const name = input.name.toLowerCase();
  const target = input.target.toLowerCase();

  // Strong, name-driven signals first — these are unambiguous regardless of
  // which muscle the dataset tagged as primary.
  if (includesAny(name, ['deadlift', 'hip thrust', 'good morning', 'glute bridge'])) {
    return { pattern: 'hip_dominant', confidence: 0.95 };
  }
  // Single-joint glute isolation, not a hip-hinge compound — checked before
  // the generic hip_dominant fallback below.
  if (
    includesAny(name, [
      'kickback',
      'donkey kick',
      'fire hydrant',
      'clamshell',
      'hip abduction',
      'hip adduction',
    ])
  ) {
    return { pattern: 'isolation', confidence: 0.85 };
  }
  if (includesAny(name, ['squat', 'lunge', 'leg press', 'step-up', 'step up'])) {
    return { pattern: 'knee_dominant', confidence: 0.95 };
  }
  if (includesAny(name, ['pulldown', 'pull-up', 'pullup', 'chin-up', 'chinup'])) {
    return { pattern: 'vertical_pull', confidence: 0.95 };
  }
  if (includesAny(name, ['row'])) {
    return { pattern: 'horizontal_pull', confidence: 0.9 };
  }
  if (includesAny(name, ['overhead press', 'shoulder press', 'military press', 'push press'])) {
    return { pattern: 'vertical_push', confidence: 0.95 };
  }
  if (includesAny(name, ['bench press', 'push-up', 'pushup', 'chest press', 'dip'])) {
    return { pattern: 'horizontal_push', confidence: 0.9 };
  }

  // Target-muscle-driven fallback, lower confidence — a "curl" targeting
  // biceps is isolation, but a compound row also involves biceps, so this
  // tier is intentionally coarse.
  if (target === 'glutes' || target === 'hamstrings' || target === 'spine') {
    if (includesAny(name, ['curl', 'extension', 'raise'])) {
      return { pattern: 'isolation', confidence: 0.6 };
    }
    return { pattern: input.bodyPart === 'waist' ? 'core' : 'hip_dominant', confidence: 0.5 };
  }
  if (target === 'quads') {
    return {
      pattern: includesAny(name, ['extension']) ? 'isolation' : 'knee_dominant',
      confidence: 0.55,
    };
  }
  if (target === 'lats' || target === 'upper back') {
    // Rows here are already past the pulldown/pull-up/row keyword checks
    // above, so this is almost always a less common pull variant, rarely
    // an isolation move — lats/upper back have no common single-joint
    // exercise in this dataset's naming.
    return { pattern: 'horizontal_pull', confidence: 0.72 };
  }
  if (target === 'pectorals') {
    return {
      pattern: includesAny(name, ['fly', 'flye', 'crossover']) ? 'isolation' : 'horizontal_push',
      confidence: 0.72,
    };
  }
  if (target === 'delts') {
    return {
      pattern: includesAny(name, ['lateral', 'front raise', 'rear delt', 'reverse fly'])
        ? 'isolation'
        : 'vertical_push',
      confidence: 0.72,
    };
  }
  if (target === 'abs' || target === 'spine') {
    return { pattern: 'core', confidence: 0.72 };
  }

  // Small, clearly single-joint muscle groups.
  if (
    ['biceps', 'triceps', 'forearms', 'calves', 'traps', 'abductors', 'adductors'].includes(target)
  ) {
    return { pattern: 'isolation', confidence: 0.75 };
  }

  return { pattern: 'isolation', confidence: 0.4 };
}

const TIME_BASED_KEYWORDS = [
  'plank',
  'hold',
  'isometric',
  'wall sit',
  'dead hang',
  'hang',
  'flexion',
];

function classifyTrackingType(input: EnrichmentInput): {
  type: TrackingType;
  confidence: number;
} {
  const name = input.name.toLowerCase();

  if (includesAny(name, TIME_BASED_KEYWORDS)) {
    return { type: 'time', confidence: 0.85 };
  }

  if (input.bodyPart === 'cardio') {
    if (includesAny(name, ['run', 'jog', 'walk', 'cycle', 'bike', 'row', 'ski'])) {
      return { type: 'distance', confidence: 0.5 };
    }
    return { type: 'time', confidence: 0.7 };
  }

  return { type: 'reps', confidence: 0.9 };
}

const ADVANCED_KEYWORDS = [
  'clean',
  'snatch',
  'jerk',
  'pistol',
  'muscle-up',
  'muscle up',
  'single-leg',
  'single leg',
];
const BEGINNER_EQUIPMENT = new Set(['assisted', 'band', 'resistance_band', 'body_weight']);
const HEAVY_BARBELL_EQUIPMENT = new Set(['barbell', 'olympic_barbell', 'trap_bar']);

function classifyDifficulty(
  input: EnrichmentInput,
  equipmentSlug: string,
  compound: boolean,
): Difficulty {
  const name = input.name.toLowerCase();

  if (includesAny(name, ADVANCED_KEYWORDS)) return 3;
  if (compound && HEAVY_BARBELL_EQUIPMENT.has(equipmentSlug)) return 3;
  if (BEGINNER_EQUIPMENT.has(equipmentSlug) || name.includes('machine')) return 1;
  return 2;
}

function estimateAvgSecondsPerRep(
  trackingType: TrackingType,
  compound: boolean,
  name: string,
): number | null {
  if (trackingType !== 'reps') return null;
  if (includesAny(name.toLowerCase(), ['jump', 'burpee', 'snap'])) return 2;
  return compound ? 4 : 3;
}

/**
 * Rule-based enrichment: derives fields the dataset doesn't provide.
 * See AGENTS.md / plan Bloque D for rationale. Confidence below ~0.7 on
 * either classifier routes the row to catalog-review.csv for manual
 * correction via data/overrides.json.
 */
export function enrichExercise(input: EnrichmentInput, equipmentSlug: string): EnrichmentResult {
  const { pattern, confidence: movementPatternConfidence } = classifyMovementPattern(input);
  const { type: trackingType, confidence: trackingTypeConfidence } = classifyTrackingType(input);
  const compound = COMPOUND_PATTERNS.has(pattern);
  const difficulty = classifyDifficulty(input, equipmentSlug, compound);
  const avgSecondsPerRep = estimateAvgSecondsPerRep(trackingType, compound, input.name);

  return {
    movementPattern: pattern,
    movementPatternConfidence,
    compound,
    difficulty,
    trackingType,
    trackingTypeConfidence,
    avgSecondsPerRep,
  };
}
