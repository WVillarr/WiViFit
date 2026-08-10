import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as SQLite from 'expo-sqlite';

export const USER_DB_NAME = 'user.db';

/**
 * Opens the on-device, read-write user database — workouts, routines,
 * measurements, everything the person creates. Kept in a separate file from
 * catalog.db on purpose: catalog.db gets replaced wholesale on every app
 * update, and if user data lived in the same file that replacement would
 * wipe workout history. Cross-database reads (e.g. "my PR on this catalog
 * exercise") use `ATTACH DATABASE` rather than merging the files.
 *
 * No tables are defined yet — routines/sessions/PRs land in Fase 2.
 */
export function openUserDb() {
  const expo = SQLite.openDatabaseSync(USER_DB_NAME);
  return drizzle(expo);
}

export type UserDb = ReturnType<typeof openUserDb>;
