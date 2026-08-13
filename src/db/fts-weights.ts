/**
 * bm25() column weights for `exercises_fts`, as a bare string so both the app
 * (src/db/catalog-client.ts) and the pipeline's acceptance test
 * (scripts/catalog.test.ts) read the same numbers. Kept free of any expo or
 * drizzle import so it loads under plain node.
 *
 * One weight per column, in declaration order — bm25() counts UNINDEXED columns
 * too, so `id` needs a slot of its own even though it can never match. Passing
 * fewer weights than there are columns does not error: SQLite pads the tail
 * with 1.0 and every weight silently applies to the column before the intended
 * one.
 *
 *   id   name  name_es  instructions_en  instructions_es  target  equipment
 *
 * `name` and `name_es` both get the high weight — a Spanish query should win
 * on the translated name exactly as readily as an English one wins on the
 * original, and a name that failed translation (see nameEs in
 * catalog-schema.ts) still has the English column to match against.
 *
 * Note that these weights only decide how much each column contributes — they
 * cannot undo bm25's length normalisation, which measures the whole row. With
 * the two instruction columns in the same table, an exercise's ranking still
 * tracks how long its instructions are more than how well its name matches, so
 * "barbell bench press" lands well below shorter-worded variants no matter what
 * `name` is weighted at. Fixing that means indexing names apart from prose, not
 * tuning these numbers.
 */
export const FTS_BM25_WEIGHTS = '1.0, 10.0, 10.0, 1.0, 1.0, 2.0, 1.0';
