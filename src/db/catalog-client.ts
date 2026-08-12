import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import * as catalogSchema from './catalog-schema';
import { FTS_BM25_WEIGHTS } from './fts-weights';

/**
 * Bump whenever scripts/build-catalog.ts regenerates assets/catalog.db with
 * changed contents. expo-sqlite imports a bundled asset database only when no
 * file of that name exists yet, so a fixed name would keep serving the copy
 * imported by a previous install. Versioning the name forces the new catalog
 * to be imported. User data is unaffected — it lives in user.db.
 */
export const CATALOG_DB_VERSION = 2;
export const CATALOG_DB_NAME = `catalog-v${CATALOG_DB_VERSION}.db`;

/**
 * The bundled, read-only exercise catalog. The database file is built by
 * scripts/build-catalog.ts and shipped as a binary asset; the app never
 * writes to it. Must be called under a `<SQLiteProvider databaseName={
 * CATALOG_DB_NAME} assetSource={{ assetId: require('../../assets/catalog.db')
 * }}>` (see src/app/_layout.tsx) — that's what copies the bundled asset into
 * the writable SQLite directory on first launch.
 */
export function useCatalogDb() {
  const expo = useSQLiteContext();
  return useMemo(() => drizzle(expo, { schema: catalogSchema }), [expo]);
}

export type CatalogDb = ReturnType<typeof useCatalogDb>;

export interface ExerciseSearchHit {
  id: string;
}

/** name weighted well above instructions/target/equipment so title matches win. */
const FTS_WEIGHTS = sql.raw(FTS_BM25_WEIGHTS);

/**
 * FTS5 full-text search over exercise names/instructions. The virtual table
 * is created by the build pipeline (see scripts/build-catalog.ts) and is not
 * representable in the Drizzle schema DSL, so it's queried with raw SQL.
 *
 * Native only. On web, expo-sqlite runs a wa-sqlite WASM build compiled
 * without FTS5 (nor FTS3/4 or R-Tree), so this rejects with `no such module:
 * fts5` and the search field comes up empty — the muscle filters and every
 * other catalog query still work. Fixing it would mean shipping a custom
 * SQLite build or adding a LIKE-based fallback; neither is worth it while web
 * is only a preview target.
 */
export async function searchExercises(
  db: CatalogDb,
  query: string,
  limit = 50,
): Promise<ExerciseSearchHit[]> {
  // Quote each term as a literal token (prefix-matched) so user input can't
  // be interpreted as FTS5 query syntax (AND/OR/NOT, column filters, etc).
  const ftsQuery = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((term) => `"${term.replace(/"/g, '""')}"*`)
    .join(' ');

  if (!ftsQuery) return [];

  return db.all<ExerciseSearchHit>(
    sql`SELECT id FROM exercises_fts WHERE exercises_fts MATCH ${ftsQuery} ORDER BY bm25(exercises_fts, ${FTS_WEIGHTS}) LIMIT ${limit}`,
  );
}
