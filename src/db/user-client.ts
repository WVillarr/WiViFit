import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';
import { useMemo } from 'react';

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
`;

/**
 * Opens the on-device, read-write user database — workouts, routines,
 * measurements, everything the person creates. Kept in a separate file from
 * catalog.db on purpose: catalog.db gets replaced wholesale on every app
 * update, and if user data lived in the same file that replacement would
 * wipe workout history. Cross-database reads (e.g. "my PR on this catalog
 * exercise") use `ATTACH DATABASE` rather than merging the files.
 *
 * expo-sqlite caches native connections by name, so opening it repeatedly
 * (as every `useUserDb()` call does) returns the same underlying handle
 * rather than a new file lock.
 */
export function openUserDb() {
  const expo = SQLite.openDatabaseSync(USER_DB_NAME);
  expo.execSync(SCHEMA_SQL);
  return drizzle(expo, { schema: userSchema });
}

export type UserDb = ReturnType<typeof openUserDb>;

export function useUserDb() {
  return useMemo(() => openUserDb(), []);
}
