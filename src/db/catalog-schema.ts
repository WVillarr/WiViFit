import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

import type { MovementPattern, TrackingType } from './enrichment-types';

/**
 * catalog.db — bundled with the app binary, read-only at runtime, rebuilt
 * from scratch by scripts/build-catalog.ts on every pipeline run. Never
 * migrated in place; user data never lives here (see user-schema.ts).
 */
export const exercises = sqliteTable(
  'exercises',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    bodyPart: text('body_part').notNull(),
    equipment: text('equipment').notNull(),
    target: text('target').notNull(),
    muscleGroup: text('muscle_group').notNull(),
    instructionsEn: text('instructions_en').notNull(),
    instructionsEs: text('instructions_es').notNull(),
    /** JSON-encoded string[] */
    instructionStepsEn: text('instruction_steps_en').notNull(),
    /** JSON-encoded string[] */
    instructionStepsEs: text('instruction_steps_es').notNull(),
    mediaId: text('media_id').notNull(),
    imagePath: text('image_path').notNull(),
    gifPath: text('gif_path').notNull(),
    attribution: text('attribution').notNull(),
    createdAt: text('created_at').notNull(),

    // Bloque D enrichment (rule-derived, see scripts/build-catalog.ts)
    movementPattern: text('movement_pattern').$type<MovementPattern>().notNull(),
    compound: integer('compound', { mode: 'boolean' }).notNull(),
    difficulty: integer('difficulty').notNull(),
    trackingType: text('tracking_type').$type<TrackingType>().notNull(),
    avgSecondsPerRep: real('avg_seconds_per_rep'),
    enrichmentConfidence: real('enrichment_confidence').notNull(),
  },
  (table) => [
    index('exercises_target_idx').on(table.target),
    index('exercises_body_part_idx').on(table.bodyPart),
  ],
);

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
    index('exercise_secondary_muscles_muscle_idx').on(table.muscle),
  ],
);

export type ExerciseRow = typeof exercises.$inferSelect;
export type ExerciseSecondaryMuscleRow = typeof exerciseSecondaryMuscles.$inferSelect;
