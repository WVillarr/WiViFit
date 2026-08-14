import { integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { MovementPattern, TrackingType } from './enrichment-types';

/**
 * catalog.db — bundled with the app binary, read-only at runtime, rebuilt
 * from scratch by scripts/build-catalog.ts on every pipeline run. Never
 * migrated in place; user data never lives here (see user-schema.ts).
 *
 * Deliberately narrow: `instructions_en/es`, `image_path`, `created_at` and
 * `muscle_group` had no reader anywhere in the app — they existed only to
 * feed the old single FTS table, which is what made this table 4.27 MB of
 * the file's 7.25 MB. `gif_path` and `attribution` are gone too, derived
 * instead from `media_id` by MediaProvider (see src/media/media-provider.ts)
 * since every catalog GIF path is exactly `videos/{id}-{mediaId}.gif` and
 * every row shares the same one-sentence credit line. Instructions moved to
 * exerciseInstructions below; full-text search moved to two FTS5 virtual
 * tables — exercises_fts_name and exercises_fts_prose (see catalog-client.ts
 * for why they're split) — neither representable in the drizzle schema DSL.
 */
export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    /** Rule-translated by scripts/exercise-names-es.ts; null when a token in
     *  the English name didn't resolve (see catalog-names-review.csv) — the
     *  UI falls back to `name` when this is null. */
    nameEs: text('name_es'),
    bodyPart: text('body_part').notNull(),
    equipment: text('equipment').notNull(),
    target: text('target').notNull(),
    mediaId: text('media_id').notNull(),

    // Bloque D enrichment (rule-derived, see scripts/build-catalog.ts)
    movementPattern: text('movement_pattern').$type<MovementPattern>().notNull(),
    compound: integer('compound', { mode: 'boolean' }).notNull(),
    difficulty: integer('difficulty').notNull(),
    trackingType: text('tracking_type').$type<TrackingType>().notNull(),
    avgSecondsPerRep: real('avg_seconds_per_rep'),
    enrichmentConfidence: real('enrichment_confidence').notNull(),
  },
  // No index on target/bodyPart: the table is small enough (~150 KB) that the
  // 4-dimension filter in exercises.tsx does a full scan regardless — the OR
  // across equipment/pattern/difficulty defeats a single-column index anyway.
  // scripts/catalog.test.ts pins the exact column list so a future column
  // addition is a deliberate choice, not scope creep back toward 4 MB.
);

/**
 * Split from `exercises` on purpose: the instruction prose is read on exactly
 * one screen (exercise/[id].tsx) and never filtered or sorted on, so keeping
 * it out of the row every list query touches is what keeps that row ~110
 * bytes instead of ~2.1 KB. See exercisesFtsProse for how this text is
 * searched without being duplicated into the FTS index too.
 */
export const exerciseInstructions = sqliteTable('exercise_instructions', {
  exerciseId: text('exercise_id')
    .primaryKey()
    .references(() => exercises.id),
  /** JSON-encoded string[] */
  stepsEn: text('steps_en').notNull(),
  /** JSON-encoded string[] */
  stepsEs: text('steps_es').notNull(),
});

export const exerciseSecondaryMuscles = sqliteTable(
  'exercise_secondary_muscles',
  {
    exerciseId: text('exercise_id')
      .notNull()
      .references(() => exercises.id),
    muscle: text('muscle').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.exerciseId, table.muscle] }),
    // No index on `muscle`: every read of this table is already scoped by
    // exerciseId (single-exercise detail lookup) or scans the whole table
    // for the secondary-muscle toggle in exercises.tsx, neither of which a
    // muscle-only index would serve.
  ],
);

/**
 * One row per `exercises.target` (19 rows), computed once at build time
 * rather than aggregated on every screen mount. `primaryCount` is exercises
 * where this is the primary target; `inclusiveCount` adds exercises where it
 * shows up as a secondary muscle (via TARGET_TO_SECONDARY, see
 * secondary-muscles.ts) — the number the "include secondary muscles" toggle
 * in exercises.tsx switches between in the body-map caption.
 */
export const muscleCounts = sqliteTable('muscle_counts', {
  target: text('target').primaryKey(),
  primaryCount: integer('primary_count').notNull(),
  inclusiveCount: integer('inclusive_count').notNull(),
});

export type ExerciseRow = typeof exercises.$inferSelect;
export type ExerciseInstructionsRow = typeof exerciseInstructions.$inferSelect;
export type ExerciseSecondaryMuscleRow = typeof exerciseSecondaryMuscles.$inferSelect;
export type MuscleCountRow = typeof muscleCounts.$inferSelect;

/**
 * Fields needed to render a list row (see ExerciseRow component). List
 * queries select only these so they don't haul enrichment fields they never
 * render — which also keeps them well clear of the 1MB buffer expo-sqlite's
 * web backend uses to hand results back from its worker.
 */
export type ExerciseListItem = Pick<ExerciseRow, 'id' | 'name' | 'nameEs' | 'target'>;
