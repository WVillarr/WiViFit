import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo } from 'react';

import * as catalogSchema from './catalog-schema';
import { CATALOG_DB_NAME, CATALOG_DB_VERSION } from './catalog-version';
import { asFtsPrefixMatch, ftsTerms } from './fts-query';
import { FTS_NAME_BM25_WEIGHTS } from './fts-weights';

export { CATALOG_DB_NAME, CATALOG_DB_VERSION };

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

const NAME_WEIGHTS = sql.raw(FTS_NAME_BM25_WEIGHTS);

/** Title hits below this count are worth widening the search for. */
const PROSE_FALLBACK_BELOW = 10;
/** One- and two-letter prefixes match most of the prose vocabulary; the
 *  title index alone answers those well under a millisecond, so a short
 *  term isn't worth the second query. */
const MIN_PROSE_TERM_LENGTH = 3;

/**
 * FTS5 full-text search, tiered: a title match (name or its Spanish
 * translation) always outranks a prose match, so the title index is queried
 * first and the prose index — the instruction text, in `exercises_fts_prose`
 * — only when the title alone doesn't return enough. The two are never
 * blended into one score: they come from different corpora with different
 * average document lengths, so their bm25 numbers aren't comparable (see
 * fts-weights.ts for why a single shared index used to rank titles badly).
 *
 * Both virtual tables are created by the build pipeline (see
 * scripts/build-catalog.ts) and aren't representable in the Drizzle schema
 * DSL, so they're queried with raw SQL.
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
  const terms = ftsTerms(query);
  if (terms.length === 0) return [];
  const match = asFtsPrefixMatch(terms);

  const byName = await db.all<ExerciseSearchHit>(
    sql`SELECT id FROM exercises_fts_name WHERE exercises_fts_name MATCH ${match} ORDER BY bm25(exercises_fts_name, ${NAME_WEIGHTS}) LIMIT ${limit}`,
  );

  if (byName.length >= PROSE_FALLBACK_BELOW) return byName;
  if (terms.some((term) => term.length < MIN_PROSE_TERM_LENGTH)) return byName;

  // exercises_fts_prose is contentless with rowid = the exercise's id read as
  // an integer (build-catalog.ts asserts every id is a unique 4-digit
  // string, so this is a bijection) — printf pads it back to the same
  // zero-padded id every other table uses, so callers never see the
  // difference.
  const byProse = await db.all<ExerciseSearchHit>(
    sql`SELECT printf('%04d', rowid) AS id FROM exercises_fts_prose WHERE exercises_fts_prose MATCH ${match} ORDER BY bm25(exercises_fts_prose) LIMIT ${limit}`,
  );

  const seen = new Set(byName.map((hit) => hit.id));
  return [...byName, ...byProse.filter((hit) => !seen.has(hit.id))].slice(0, limit);
}
