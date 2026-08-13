/**
 * Builds assets/catalog.db from hasaneyldrm/exercises-dataset.
 *
 * Usage:
 *   npx tsx scripts/build-catalog.ts [--fresh]
 *
 * --fresh forces a re-download instead of using the .cache/ copy.
 *
 * Pipeline (see AGENTS.md / plan Fase 1, Bloques C+D):
 *   1. Download + validate exercises.json against the dataset's own schema.
 *   2. Drop unused locales (keep es/en) and the redundant `category` field.
 *   3. Normalize body_part/equipment/target/muscle_group to slug keys.
 *   4. Enrich each row with movement_pattern/compound/difficulty/
 *      tracking_type/avg_seconds_per_rep (scripts/enrichment.ts).
 *   5. Apply data/overrides.json corrections (by exercise id) on top of the
 *      rule output.
 *   6. Write catalog-review.csv for rows below the confidence threshold.
 *   7. Write assets/catalog.db (exercises, exercise_secondary_muscles, and
 *      an FTS5 index over name/instructions).
 *
 * Re-running this from scratch reproduces the same catalog.db, overrides
 * included — it never hand-edits its own output.
 */
import Database from 'better-sqlite3';
import Ajv2020 from 'ajv/dist/2020';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { MOVEMENT_PATTERNS, TRACKING_TYPES } from '@/db/enrichment-types';

import { loadDataset, REPO_ROOT } from './dataset';
import { deriveFrom, enrichExercise } from './enrichment';

const OUT_DB_PATH = path.join(REPO_ROOT, 'assets', 'catalog.db');
const OVERRIDES_PATH = path.join(REPO_ROOT, 'data', 'overrides.json');
const REVIEW_CSV_PATH = path.join(REPO_ROOT, 'catalog-review.csv');
const CONFIDENCE_THRESHOLD = 0.7;

interface OverrideEntry {
  movementPattern?: string;
  compound?: boolean;
  difficulty?: number;
  trackingType?: string;
  avgSecondsPerRep?: number | null;
}

const OVERRIDE_FIELDS = new Set([
  'movementPattern',
  'compound',
  'difficulty',
  'trackingType',
  'avgSecondsPerRep',
]);

/**
 * Loaded once per build and hand-authored, so a typo here is expensive to
 * miss silently — `movement_pattern` instead of `movementPattern` used to do
 * nothing and no one would notice until a routine came out wrong in Fase 3.
 */
function loadOverrides(datasetIds: ReadonlySet<string>): Record<string, OverrideEntry> {
  if (!existsSync(OVERRIDES_PATH)) return {};
  const raw = JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8')) as Record<string, unknown>;

  for (const [id, value] of Object.entries(raw)) {
    if (!datasetIds.has(id)) {
      throw new Error(`data/overrides.json: "${id}" is not an exercise id in the dataset`);
    }
    if (typeof value !== 'object' || value === null) {
      throw new Error(`data/overrides.json: entry for "${id}" must be an object`);
    }
    const entry = value as Record<string, unknown>;
    for (const field of Object.keys(entry)) {
      if (!OVERRIDE_FIELDS.has(field)) {
        throw new Error(`data/overrides.json: "${id}" has unknown field "${field}"`);
      }
    }
    if (
      entry.movementPattern !== undefined &&
      !(MOVEMENT_PATTERNS as readonly string[]).includes(entry.movementPattern as string)
    ) {
      throw new Error(
        `data/overrides.json: "${id}" has invalid movementPattern "${entry.movementPattern}"`,
      );
    }
    if (
      entry.trackingType !== undefined &&
      !(TRACKING_TYPES as readonly string[]).includes(entry.trackingType as string)
    ) {
      throw new Error(
        `data/overrides.json: "${id}" has invalid trackingType "${entry.trackingType}"`,
      );
    }
    if (entry.difficulty !== undefined && ![1, 2, 3].includes(entry.difficulty as number)) {
      throw new Error(`data/overrides.json: "${id}" has invalid difficulty "${entry.difficulty}"`);
    }
    if (entry.compound !== undefined && typeof entry.compound !== 'boolean') {
      throw new Error(`data/overrides.json: "${id}" compound must be a boolean`);
    }
    if (
      entry.avgSecondsPerRep !== undefined &&
      entry.avgSecondsPerRep !== null &&
      typeof entry.avgSecondsPerRep !== 'number'
    ) {
      throw new Error(`data/overrides.json: "${id}" avgSecondsPerRep must be a number or null`);
    }
  }

  return raw as Record<string, OverrideEntry>;
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function main() {
  const fresh = process.argv.includes('--fresh');
  const { schema, exercises: rawExercises } = await loadDataset(fresh);

  console.log(`Validating ${rawExercises.length} exercises against exercises.schema.json`);
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(schema as object);
  if (!validate(rawExercises)) {
    console.error('Dataset failed schema validation:');
    console.error(JSON.stringify(validate.errors, null, 2));
    process.exit(1);
  }

  const overrides = loadOverrides(new Set(rawExercises.map((r) => r.id)));

  const seenIds = new Set<string>();
  const reviewRows: string[] = [
    'id,name,target,equipment,movement_pattern,tracking_type,confidence,overridden',
  ];

  interface BuiltExercise {
    id: string;
    name: string;
    bodyPart: string;
    equipment: string;
    target: string;
    muscleGroup: string;
    instructionsEn: string;
    instructionsEs: string;
    instructionStepsEn: string;
    instructionStepsEs: string;
    mediaId: string;
    imagePath: string;
    gifPath: string;
    attribution: string;
    createdAt: string;
    movementPattern: string;
    compound: 0 | 1;
    difficulty: number;
    trackingType: string;
    avgSecondsPerRep: number | null;
    enrichmentConfidence: number;
    secondaryMuscles: string[];
  }

  const built: BuiltExercise[] = rawExercises.map((raw) => {
    if (seenIds.has(raw.id)) {
      throw new Error(`Duplicate exercise id in dataset: ${raw.id}`);
    }
    seenIds.add(raw.id);

    const equipmentSlug = slugify(raw.equipment);
    const enrichment = enrichExercise(
      { name: raw.name, target: raw.target, equipment: raw.equipment, bodyPart: raw.body_part },
      equipmentSlug,
    );

    const override = overrides[raw.id] ?? {};
    const confidence = Math.min(
      enrichment.movementPatternConfidence,
      enrichment.trackingTypeConfidence,
    );

    // Re-derive from the EFFECTIVE pattern/tracking type, not the rule's raw
    // guess — otherwise an override that changes movementPattern silently
    // leaves compound/difficulty/avgSecondsPerRep computed for the pattern it
    // just replaced. See deriveFrom's docstring and the regression test in
    // scripts/enrichment.test.ts.
    const effectivePattern = (override.movementPattern as string) ?? enrichment.movementPattern;
    const effectiveTrackingType = (override.trackingType as string) ?? enrichment.trackingType;
    const derived = deriveFrom(
      { name: raw.name, target: raw.target, equipment: raw.equipment, bodyPart: raw.body_part },
      equipmentSlug,
      effectivePattern as never,
      effectiveTrackingType as never,
    );

    if (confidence < CONFIDENCE_THRESHOLD) {
      reviewRows.push(
        [
          raw.id,
          raw.name,
          raw.target,
          raw.equipment,
          effectivePattern,
          effectiveTrackingType,
          confidence.toFixed(2),
          raw.id in overrides ? 'yes' : 'no',
        ]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(','),
      );
    }

    return {
      id: raw.id,
      name: raw.name,
      bodyPart: slugify(raw.body_part),
      equipment: equipmentSlug,
      target: slugify(raw.target),
      muscleGroup: slugify(raw.muscle_group),
      instructionsEn: raw.instructions.en,
      instructionsEs: raw.instructions.es,
      instructionStepsEn: JSON.stringify(raw.instruction_steps.en),
      instructionStepsEs: JSON.stringify(raw.instruction_steps.es),
      mediaId: raw.media_id,
      imagePath: raw.image,
      gifPath: raw.gif_url,
      attribution: raw.attribution,
      createdAt: raw.created_at,
      movementPattern: effectivePattern,
      compound: ((override.compound as boolean) ?? derived.compound) ? 1 : 0,
      difficulty: (override.difficulty as number) ?? derived.difficulty,
      trackingType: effectiveTrackingType,
      avgSecondsPerRep:
        override.avgSecondsPerRep !== undefined ? override.avgSecondsPerRep : derived.avgSecondsPerRep,
      enrichmentConfidence: confidence,
      secondaryMuscles: raw.secondary_muscles.map(slugify),
    };
  });

  writeFileSync(REVIEW_CSV_PATH, reviewRows.join('\n') + '\n', 'utf-8');
  const overriddenCount = Object.keys(overrides).length;
  console.log(
    `Wrote ${REVIEW_CSV_PATH} (${reviewRows.length - 1} rows below confidence ${CONFIDENCE_THRESHOLD}, ` +
      `${overriddenCount} already have an override)`,
  );

  mkdirSync(path.dirname(OUT_DB_PATH), { recursive: true });
  if (existsSync(OUT_DB_PATH)) {
    require('node:fs').unlinkSync(OUT_DB_PATH);
  }

  const db = new Database(OUT_DB_PATH);
  // Must stay in the rollback-journal mode: catalog.db is read-only at
  // runtime (so WAL buys nothing), and wa-sqlite's OPFS VFS — what
  // expo-sqlite uses on web — cannot open a WAL-mode database at all.
  db.pragma('journal_mode = DELETE');

  db.exec(`
    CREATE TABLE exercises (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      body_part TEXT NOT NULL,
      equipment TEXT NOT NULL,
      target TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      instructions_en TEXT NOT NULL,
      instructions_es TEXT NOT NULL,
      instruction_steps_en TEXT NOT NULL,
      instruction_steps_es TEXT NOT NULL,
      media_id TEXT NOT NULL,
      image_path TEXT NOT NULL,
      gif_path TEXT NOT NULL,
      attribution TEXT NOT NULL,
      created_at TEXT NOT NULL,
      movement_pattern TEXT NOT NULL,
      compound INTEGER NOT NULL,
      difficulty INTEGER NOT NULL,
      tracking_type TEXT NOT NULL,
      avg_seconds_per_rep REAL,
      enrichment_confidence REAL NOT NULL
    );
    CREATE INDEX exercises_target_idx ON exercises(target);
    CREATE INDEX exercises_body_part_idx ON exercises(body_part);

    CREATE TABLE exercise_secondary_muscles (
      exercise_id TEXT NOT NULL REFERENCES exercises(id),
      muscle TEXT NOT NULL,
      PRIMARY KEY (exercise_id, muscle)
    );
    CREATE INDEX exercise_secondary_muscles_muscle_idx ON exercise_secondary_muscles(muscle);

    CREATE VIRTUAL TABLE exercises_fts USING fts5(
      id UNINDEXED,
      name,
      instructions_en,
      instructions_es,
      target,
      equipment
    );
  `);

  const insertExercise = db.prepare(`
    INSERT INTO exercises (
      id, name, body_part, equipment, target, muscle_group,
      instructions_en, instructions_es, instruction_steps_en, instruction_steps_es,
      media_id, image_path, gif_path, attribution, created_at,
      movement_pattern, compound, difficulty, tracking_type, avg_seconds_per_rep, enrichment_confidence
    ) VALUES (
      @id, @name, @bodyPart, @equipment, @target, @muscleGroup,
      @instructionsEn, @instructionsEs, @instructionStepsEn, @instructionStepsEs,
      @mediaId, @imagePath, @gifPath, @attribution, @createdAt,
      @movementPattern, @compound, @difficulty, @trackingType, @avgSecondsPerRep, @enrichmentConfidence
    )
  `);
  const insertSecondaryMuscle = db.prepare(
    `INSERT INTO exercise_secondary_muscles (exercise_id, muscle) VALUES (?, ?)`,
  );
  const insertFts = db.prepare(
    `INSERT INTO exercises_fts (id, name, instructions_en, instructions_es, target, equipment) VALUES (?, ?, ?, ?, ?, ?)`,
  );

  const insertAll = db.transaction((rows: BuiltExercise[]) => {
    for (const row of rows) {
      insertExercise.run(row);
      for (const muscle of new Set(row.secondaryMuscles)) {
        insertSecondaryMuscle.run(row.id, muscle);
      }
      insertFts.run(
        row.id,
        row.name,
        row.instructionsEn,
        row.instructionsEs,
        row.target,
        row.equipment,
      );
    }
  });
  insertAll(built);

  // Ships inside the app binary, so reclaim the free pages left by the bulk load.
  db.exec('VACUUM');
  db.close();

  const sizeMb = statSync(OUT_DB_PATH).size / 1024 / 1024;
  const highConfidence = built.filter((r) => r.enrichmentConfidence >= CONFIDENCE_THRESHOLD).length;
  console.log(`\nBuilt ${OUT_DB_PATH}`);
  console.log(`  ${built.length} exercises, ${sizeMb.toFixed(1)} MB`);
  console.log(
    `  ${highConfidence} high-confidence (${((highConfidence / built.length) * 100).toFixed(1)}%), ` +
      `${built.length - highConfidence} flagged for review`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
