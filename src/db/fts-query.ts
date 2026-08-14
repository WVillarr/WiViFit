/**
 * Kept free of any expo/drizzle import — scripts/catalog.test.ts imports this
 * directly under plain node to hold the tokenizer contract as a regression
 * test, independent of the app runtime.
 *
 * Splits the way FTS5's unicode61 tokenizer does: anything that isn't a
 * letter or digit is a separator. This is load-bearing, not cosmetic —
 * exercises_fts_prose (see catalog-client.ts) is built `detail='none'`, which
 * rejects phrase queries outright, and 163 of the 1,324 exercise names
 * contain a hyphen. A naive whitespace split turns "pull-up" into the phrase
 * `"pull-up"*`, and FTS5 throws `phrase queries are not supported
 * (detail!=full)` the moment that reaches the prose table. Splitting on the
 * index's own token boundaries also means a `"` can never survive into a
 * term, so quoting each term below is enough to keep user input from being
 * read as FTS5 query syntax (AND/OR/NOT, column filters, etc).
 */
export function ftsTerms(query: string): string[] {
  return query
    .trim()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Each term as a quoted literal prefix match, joined for an implicit AND. */
export function asFtsPrefixMatch(terms: string[]): string {
  return terms.map((term) => `"${term.replace(/"/g, '""')}"*`).join(' ');
}
