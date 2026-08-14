/**
 * Kept free of any expo/drizzle import — like fts-weights.ts, this needs to
 * load under plain node (scripts/build-catalog.ts, scripts/catalog.test.ts)
 * as well as inside the app.
 *
 * Bump whenever scripts/build-catalog.ts regenerates assets/catalog.db with
 * changed *contents* — a schema change, a different enrichment/translation
 * pass, anything that isn't a byte-identical rebuild. expo-sqlite imports a
 * bundled asset database only when no file of that name exists yet, so a
 * fixed name would keep serving the copy imported by a previous install:
 * every device that already ran the app would silently keep the OLD schema
 * and the first query against a renamed/removed table would throw `no such
 * table`, which reads like a code bug rather than a stale build. Versioning
 * the name forces the new catalog to be imported. User data is unaffected —
 * it lives in user.db, a separate file (see user-client.ts).
 *
 * scripts/catalog.test.ts asserts this matches `PRAGMA user_version` stamped
 * into the built file, so forgetting to bump this after a schema change fails
 * `npm test` instead of failing silently on a device that already has the
 * old file.
 */
export const CATALOG_DB_VERSION = 3;
export const CATALOG_DB_NAME = `catalog-v${CATALOG_DB_VERSION}.db`;
