/**
 * bm25() column weights for `exercises_fts_name`, as a bare string so both the
 * app (src/db/catalog-client.ts) and the pipeline's acceptance test
 * (scripts/catalog.test.ts) read the same numbers. Kept free of any expo or
 * drizzle import so it loads under plain node.
 *
 * One weight per column, in declaration order — bm25() counts UNINDEXED
 * columns too, so `id` needs a slot of its own even though it can never
 * match (its weight is 0.0, spelled out rather than left to pad with 1.0, so
 * that's explicit rather than incidental). Passing fewer weights than there
 * are columns does not error: SQLite pads the tail with 1.0 and every weight
 * silently applies to the column before the intended one.
 *
 *   id   name   name_es   target   equipment
 *
 * `name` and `name_es` share the same high weight — a Spanish query should
 * win on the translated name exactly as readily as an English one wins on
 * the original, and a name that failed translation (see nameEs in
 * catalog-schema.ts, and docs/name-overrides-proposal.md for which ones)
 * still has the English column to match against.
 *
 * There used to be a single `exercises_fts` table that also indexed
 * `instructions_en`/`instructions_es`, and no weight here could fix its
 * ranking: bm25's length normalisation measures the *whole row*, so an
 * exercise's score tracked how long its instructions were more than how well
 * its name matched, and "barbell bench press" landed below shorter-worded
 * variants no matter what `name` was weighted at. That's why prose search now
 * lives in a separate table, `exercises_fts_prose` (see catalog-client.ts) —
 * a title match and a prose match are never blended into one bm25 score, only
 * tiered: title results first, prose only as a fallback when there aren't
 * enough of them. Title ranking is exactly what these weights control now.
 */
export const FTS_NAME_BM25_WEIGHTS = '0.0, 10.0, 10.0, 2.0, 1.0';
