import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import { useEffect, useState } from 'react';

import * as userSchema from './user-schema';

export const USER_DB_NAME = 'user.db';

/**
 * Idempotent — safe to run on every call. There's no migration tracking yet
 * (see user-schema.ts), so this doubles as the whole schema story: it either
 * creates the tables on a fresh install or no-ops on every later launch.
 */
const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS favorites (
    exercise_id TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS recently_viewed (
    exercise_id TEXT PRIMARY KEY,
    viewed_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS recently_viewed_viewed_at_idx ON recently_viewed(viewed_at);

  CREATE TABLE IF NOT EXISTS routines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    split_type TEXT,
    days_per_week INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 0,
    source TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS routine_days (
    id TEXT PRIMARY KEY,
    routine_id TEXT NOT NULL,
    day_index INTEGER NOT NULL,
    name TEXT NOT NULL,
    budget_minutes INTEGER,
    deleted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS routine_days_routine_id_idx ON routine_days(routine_id);
  CREATE TABLE IF NOT EXISTS routine_exercises (
    id TEXT PRIMARY KEY,
    routine_day_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    order_index INTEGER NOT NULL,
    target_sets INTEGER NOT NULL,
    rep_range_min INTEGER,
    rep_range_max INTEGER,
    target_duration_seconds INTEGER,
    target_distance_meters INTEGER,
    rest_seconds INTEGER NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS routine_exercises_routine_day_id_idx ON routine_exercises(routine_day_id);

  CREATE TABLE IF NOT EXISTS workout_sessions (
    id TEXT PRIMARY KEY,
    routine_day_id TEXT,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    total_volume_kg REAL,
    deleted_at TEXT
  );
  CREATE TABLE IF NOT EXISTS session_sets (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    exercise_id TEXT NOT NULL,
    set_index INTEGER NOT NULL,
    weight_kg REAL,
    reps INTEGER,
    duration_seconds INTEGER,
    distance_meters REAL,
    is_warmup INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT NOT NULL,
    deleted_at TEXT
  );
  CREATE INDEX IF NOT EXISTS session_sets_session_id_idx ON session_sets(session_id);
  CREATE INDEX IF NOT EXISTS session_sets_exercise_id_idx ON session_sets(exercise_id);

  CREATE TABLE IF NOT EXISTS personal_records (
    id TEXT PRIMARY KEY,
    exercise_id TEXT NOT NULL,
    type TEXT NOT NULL,
    value REAL NOT NULL,
    context_weight_kg REAL,
    achieved_at TEXT NOT NULL,
    session_set_id TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS personal_records_exercise_type_idx ON personal_records(exercise_id, type);

  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY,
    table_name TEXT NOT NULL,
    row_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    created_at TEXT NOT NULL,
    synced_at TEXT
  );
  CREATE INDEX IF NOT EXISTS outbox_synced_at_idx ON outbox(synced_at);
`;

/**
 * Opens the on-device, read-write user database — workouts, routines,
 * measurements, everything the person creates. Kept in a separate file from
 * catalog.db on purpose: catalog.db gets replaced wholesale on every app
 * update, and if user data lived in the same file that replacement would
 * wipe workout history. Cross-database reads (e.g. "my PR on this catalog
 * exercise") use `ATTACH DATABASE` rather than merging the files.
 *
 * Async, not `openDatabaseSync`: expo-sqlite's web backend runs the sync API
 * over a `SharedArrayBuffer`-backed worker, which needs cross-origin-isolation
 * headers the dev server doesn't send — `openDatabaseSync` throws
 * `ReferenceError: SharedArrayBuffer is not defined` and takes the whole
 * screen down with it. The async API has no such requirement on any platform.
 */
async function openUserDb() {
  const expo = await SQLite.openDatabaseAsync(USER_DB_NAME);
  await expo.execAsync(SCHEMA_SQL);
  return drizzle(expo, { schema: userSchema });
}

export type UserDb = Awaited<ReturnType<typeof openUserDb>>;

// Module-level, not per-hook-call: every `useUserDb()` caller should await the
// same open+migrate instead of racing to create the schema in parallel.
let userDbPromise: Promise<UserDb> | null = null;

/** Null until the database has opened and its schema is ensured. */
export function useUserDb(): UserDb | null {
  const [db, setDb] = useState<UserDb | null>(null);

  useEffect(() => {
    let cancelled = false;
    userDbPromise ??= openUserDb();
    userDbPromise.then((opened) => {
      if (!cancelled) setDb(opened);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return db;
}
