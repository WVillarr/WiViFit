import { integer, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * user.db — created on-device, read-write, never replaced by an app update
 * (see openUserDb in user-client.ts for why it's a separate file from
 * catalog.db).
 *
 * No drizzle-kit migrations yet — `SCHEMA_SQL` in user-client.ts's
 * `openUserDb`, a `CREATE TABLE IF NOT EXISTS` per table below, is the whole
 * migration story. Once this needs an actual ALTER, that's the signal to add
 * drizzle-kit rather than hand-roll a second one.
 */
export const favorites = sqliteTable('favorites', {
  exerciseId: text('exercise_id').primaryKey(),
  createdAt: text('created_at').notNull(),
});

export const recentlyViewed = sqliteTable('recently_viewed', {
  exerciseId: text('exercise_id').primaryKey(),
  viewedAt: text('viewed_at').notNull(),
});

/**
 * Every table below uses a client-generated UUID as `id` (see
 * newId() in ids.ts), never autoincrement — an offline-created row needs an
 * id nobody else could also assign, which is what makes the outbox in
 * src/sync/ safe: two devices can both create rows without a collision to
 * resolve when they later sync.
 *
 * `exerciseId` columns are a bare `text`, not a Drizzle `.references()`: the
 * row they point to lives in catalog.db, a different physical file with no
 * real foreign-key relationship possible across the boundary. Cross-database
 * reads (e.g. a PR's exercise name) use `ATTACH DATABASE`, documented in
 * user-client.ts.
 */

// --- Routines: the template ---
export const routines = sqliteTable('routines', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** null for a manually-built routine; set once Fase 3's generator exists. */
  splitType: text('split_type'),
  daysPerWeek: integer('days_per_week').notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).notNull().default(false),
  source: text('source').notNull().$type<'manual' | 'generated'>(),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  /** Tombstone, not a real DELETE — an offline delete has no way to announce
   *  itself to the outbox once the row it deletes no longer exists. */
  deletedAt: text('deleted_at'),
});

export const routineDays = sqliteTable('routine_days', {
  id: text('id').primaryKey(),
  routineId: text('routine_id').notNull(),
  dayIndex: integer('day_index').notNull(),
  name: text('name').notNull(),
  /** Feeds Fase 3's auto-fit-to-time-budget logic; unset for now. */
  budgetMinutes: integer('budget_minutes'),
  deletedAt: text('deleted_at'),
});

export const routineExercises = sqliteTable('routine_exercises', {
  id: text('id').primaryKey(),
  routineDayId: text('routine_day_id').notNull(),
  exerciseId: text('exercise_id').notNull(),
  orderIndex: integer('order_index').notNull(),
  targetSets: integer('target_sets').notNull(),
  /** Set for exercises.trackingType === 'reps'; null otherwise. */
  repRangeMin: integer('rep_range_min'),
  repRangeMax: integer('rep_range_max'),
  /** Set for exercises.trackingType === 'time' or 'distance'; null otherwise. */
  targetDurationSeconds: integer('target_duration_seconds'),
  /** Set for exercises.trackingType === 'distance'; null otherwise. */
  targetDistanceMeters: integer('target_distance_meters'),
  restSeconds: integer('rest_seconds').notNull(),
  deletedAt: text('deleted_at'),
});

// --- Sessions: what actually happened ---
// Deliberately separate from routines above: if a session were just an edit
// to the routine's own rows, changing next week's plan would rewrite last
// week's history and progress could no longer be measured.
export const workoutSessions = sqliteTable('workout_sessions', {
  id: text('id').primaryKey(),
  /** null for a freeform session not tied to any routine day. */
  routineDayId: text('routine_day_id'),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  totalVolumeKg: real('total_volume_kg'),
  deletedAt: text('deleted_at'),
});

export const sessionSets = sqliteTable('session_sets', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull(),
  exerciseId: text('exercise_id').notNull(),
  setIndex: integer('set_index').notNull(),
  /** Which of these are populated follows the exercise's trackingType — see
   *  exercises.trackingType in catalog-schema.ts. Not modeled as separate
   *  tables per type: three nullable columns is simpler than a join for the
   *  handful of screens that read a set. */
  weightKg: real('weight_kg'),
  reps: integer('reps'),
  durationSeconds: integer('duration_seconds'),
  distanceMeters: real('distance_meters'),
  isWarmup: integer('is_warmup', { mode: 'boolean' }).notNull().default(false),
  completedAt: text('completed_at').notNull(),
  deletedAt: text('deleted_at'),
});

export const personalRecords = sqliteTable('personal_records', {
  id: text('id').primaryKey(),
  exerciseId: text('exercise_id').notNull(),
  type: text('type').notNull().$type<'estimated_1rm' | 'volume' | 'reps'>(),
  value: real('value').notNull(),
  /** Set only for type 'reps' — "most reps at a given weight" only means
   *  something scoped to that weight; without it, 30 reps at 5kg would beat
   *  8 reps at 50kg on raw rep count alone. See logSet's PR candidates. */
  contextWeightKg: real('context_weight_kg'),
  achievedAt: text('achieved_at').notNull(),
  sessionSetId: text('session_set_id').notNull(),
});

// --- Sync outbox — see src/sync/outbox.ts ---
export const outbox = sqliteTable('outbox', {
  id: text('id').primaryKey(),
  tableName: text('table_name').notNull(),
  rowId: text('row_id').notNull(),
  operation: text('operation').notNull().$type<'insert' | 'update' | 'delete'>(),
  /** JSON-encoded snapshot of the row at enqueue time. */
  payloadJson: text('payload_json').notNull(),
  createdAt: text('created_at').notNull(),
  /** null until a sync round-trip confirms the server has it. */
  syncedAt: text('synced_at'),
});

export type OutboxRow = typeof outbox.$inferSelect;
export type RoutineRow = typeof routines.$inferSelect;
export type RoutineDayRow = typeof routineDays.$inferSelect;
export type RoutineExerciseRow = typeof routineExercises.$inferSelect;
export type WorkoutSessionRow = typeof workoutSessions.$inferSelect;
export type SessionSetRow = typeof sessionSets.$inferSelect;
export type PersonalRecordRow = typeof personalRecords.$inferSelect;
export type FavoriteRow = typeof favorites.$inferSelect;
export type RecentlyViewedRow = typeof recentlyViewed.$inferSelect;
