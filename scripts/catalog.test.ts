/**
 * Verifies the built assets/catalog.db against the Fase 1 acceptance
 * criteria. Runs against the real artifact with better-sqlite3 rather than a
 * fixture, so a broken pipeline fails here instead of on a device.
 */
import Database from 'better-sqlite3';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { TARGET_TO_SLUG } from '../src/components/body-map/muscle-slugs';
import { EQUIPMENT_GROUP_ORDER, equipmentValuesFor } from '../src/constants/equipment-groups';
import { CATALOG_DB_VERSION } from '../src/db/catalog-version';
import { ftsTerms } from '../src/db/fts-query';
import { FTS_NAME_BM25_WEIGHTS } from '../src/db/fts-weights';
import { SECONDARY_TO_TARGET } from '../src/db/secondary-muscles';
import en from '../src/i18n/translations/en.json';
import es from '../src/i18n/translations/es.json';

const DB_PATH = path.join(__dirname, '..', 'assets', 'catalog.db');
const OVERRIDES_PATH = path.join(__dirname, '..', 'data', 'overrides.json');

const describeIfBuilt = existsSync(DB_PATH) ? describe : describe.skip;

describeIfBuilt('catalog.db', () => {
  let db: Database.Database;

  beforeAll(() => {
    db = new Database(DB_PATH, { readonly: true });
  });

  afterAll(() => db?.close());

  test('contains exactly the 1324 dataset exercises', () => {
    expect(db.prepare('SELECT COUNT(*) c FROM exercises').get()).toEqual({ c: 1324 });
  });

  test('is not in WAL mode (wa-sqlite OPFS cannot open WAL databases)', () => {
    expect(db.pragma('journal_mode', { simple: true })).toBe('delete');
  });

  test('user_version matches CATALOG_DB_VERSION', () => {
    // The one guard against shipping a schema change without bumping the
    // filename — see catalog-version.ts. If this fails, a device that
    // already ran the previous catalog-vN.db would silently keep serving it.
    expect(db.pragma('user_version', { simple: true })).toBe(CATALOG_DB_VERSION);
  });

  test('the exercises table has exactly the columns the schema declares', () => {
    const columns = (db.prepare('PRAGMA table_info(exercises)').all() as { name: string }[]).map(
      (c) => c.name,
    );
    expect(columns.sort()).toEqual(
      [
        'id',
        'name',
        'name_es',
        'body_part',
        'equipment',
        'target',
        'media_id',
        'movement_pattern',
        'compound',
        'difficulty',
        'tracking_type',
        'avg_seconds_per_rep',
        'enrichment_confidence',
      ].sort(),
    );
  });

  test('catalog.db is under the 4MB target', () => {
    const sizeMb = statSync(DB_PATH).size / (1024 * 1024);
    expect(sizeMb).toBeLessThan(4);
  });

  test('has no missing media or unassigned enrichment', () => {
    const bad = db
      .prepare(
        `SELECT COUNT(*) c FROM exercises
         WHERE media_id IS NULL OR media_id = ''
            OR movement_pattern IS NULL OR tracking_type IS NULL`,
      )
      .get() as { c: number };
    expect(bad.c).toBe(0);
  });

  test('every exercise has instructions in both locales', () => {
    const bad = db
      .prepare(
        `SELECT COUNT(*) c FROM exercises e
         LEFT JOIN exercise_instructions i ON i.exercise_id = e.id
         WHERE i.exercise_id IS NULL OR i.steps_en IS NULL OR i.steps_es IS NULL`,
      )
      .get() as { c: number };
    expect(bad.c).toBe(0);
  });

  test('every id is a 4-digit numeral, and exercises_fts_prose rowids round-trip through it', () => {
    // The prose index is contentless (see build-catalog.ts), keyed by
    // rowid = Number(id) rather than external-content bookkeeping — that's
    // only a bijection if every id is a unique 4-digit numeral. This is the
    // regression test for that contract surviving VACUUM.
    const ids = (db.prepare('SELECT id FROM exercises').all() as { id: string }[])
      .map((r) => r.id)
      .sort();
    expect(ids.every((id) => /^\d{4}$/.test(id))).toBe(true);

    const proseIds = (
      db.prepare("SELECT printf('%04d', rowid) AS id FROM exercises_fts_prose").all() as {
        id: string;
      }[]
    )
      .map((r) => r.id)
      .sort();
    expect(proseIds).toEqual(ids);
  });

  test('ftsTerms never produces a phrase query against the detail=none prose table', () => {
    // exercises_fts_prose rejects phrase queries outright (detail!=full).
    // ftsTerms' job is to split on non-alphanumerics so a hyphenated name
    // like "pull-up" never survives as one glued token that MATCH would try
    // to read as a phrase. Exercised against real edge cases from the
    // dataset, not synthetic ones.
    const cases = [
      'pull-up',
      '3/4 sit-up',
      'push up (male)',
      'close-grip bench press',
      '-',
      'a"b',
      '45°',
      'músculo',
    ];
    for (const query of cases) {
      const terms = ftsTerms(query);
      const match = terms.map((t) => `"${t}"*`).join(' ');
      if (!match) continue;
      expect(() =>
        db.prepare('SELECT rowid FROM exercises_fts_prose WHERE exercises_fts_prose MATCH ?').all(match),
      ).not.toThrow();
    }
  });

  test('FTS5 title search ranks a full name match above incidental substring matches', () => {
    const rows = db
      .prepare(
        `SELECT id, name FROM exercises_fts_name WHERE exercises_fts_name MATCH ?
         ORDER BY bm25(exercises_fts_name, ${FTS_NAME_BM25_WEIGHTS}) LIMIT 10`,
      )
      .all('"bench"* "press"*') as { id: string; name: string }[];

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.name.includes('bench') && r.name.includes('press'))).toBe(true);
  });

  test('title queries stay comfortably under the 50ms budget (desktop tripwire)', () => {
    // Not the acceptance criterion itself — that's measured on-device (see
    // docs/plan.md's verification section). This is a ~5x-headroom
    // regression guard so a future schema change can't quietly reintroduce a
    // slow path without anyone noticing until it's on a phone.
    const queries = ['"b"*', '"be"*', '"ben"*', '"bench"*', '"bench"* "p"*', '"sentadilla"*'];
    for (const q of queries) {
      const start = performance.now();
      db.prepare(
        `SELECT id FROM exercises_fts_name WHERE exercises_fts_name MATCH ? ORDER BY bm25(exercises_fts_name, ${FTS_NAME_BM25_WEIGHTS}) LIMIT 50`,
      ).all(q);
      expect(performance.now() - start).toBeLessThan(10);
    }
  });

  test('muscle_counts has one row per target and every inclusive count is at least the primary one', () => {
    const targets = db.prepare('SELECT COUNT(DISTINCT target) c FROM exercises').get() as {
      c: number;
    };
    const rows = db.prepare('SELECT COUNT(*) c FROM muscle_counts').get() as { c: number };
    expect(rows.c).toBe(targets.c);

    const bad = db
      .prepare('SELECT COUNT(*) c FROM muscle_counts WHERE inclusive_count < primary_count')
      .get() as { c: number };
    expect(bad.c).toBe(0);
  });

  test('every muscle the app can render has a name in both locales', () => {
    const targets = (db.prepare('SELECT DISTINCT target FROM exercises').all() as
      { target: string }[]).map((r) => r.target);
    const secondary = (db.prepare('SELECT DISTINCT muscle FROM exercise_secondary_muscles').all() as
      { muscle: string }[]).map((r) => r.muscle);

    for (const locale of [es, en]) {
      expect(targets.filter((m) => !(m in locale.muscles))).toEqual([]);
      expect(secondary.filter((m) => !(m in locale.muscles))).toEqual([]);
    }
  });

  test('every secondary muscle resolves for the body map', () => {
    const secondary = (db.prepare('SELECT DISTINCT muscle FROM exercise_secondary_muscles').all() as
      { muscle: string }[]).map((r) => r.muscle);

    // Each one is either mapped to a target slug, mapped to null because the
    // plate has no such region, or already a target slug in its own right.
    const unhandled = secondary.filter(
      (m) => !(m in SECONDARY_TO_TARGET) && !(m in TARGET_TO_SLUG),
    );
    expect(unhandled).toEqual([]);
  });

  test('equipment groups partition every catalog value exactly once', () => {
    const values = (db.prepare('SELECT DISTINCT equipment FROM exercises').all() as
      { equipment: string }[]).map((r) => r.equipment);
    const mapped = equipmentValuesFor(EQUIPMENT_GROUP_ORDER);

    expect([...mapped].sort()).toEqual([...values].sort());
    expect(new Set(mapped).size).toBe(mapped.length);
  });

  test('secondary muscles are linked to real exercises', () => {
    const orphans = db
      .prepare(
        `SELECT COUNT(*) c FROM exercise_secondary_muscles m
         LEFT JOIN exercises e ON e.id = m.exercise_id WHERE e.id IS NULL`,
      )
      .get() as { c: number };
    expect(orphans.c).toBe(0);
  });

  test('every exercise has a bundled thumbnail', () => {
    const ids = db.prepare('SELECT id FROM exercises').all() as { id: string }[];
    const missing = ids.filter(
      ({ id }) => !existsSync(path.join(__dirname, '..', 'assets', 'exercise-thumbs', `${id}.jpg`)),
    );
    expect(missing).toEqual([]);
  });

  test('data/overrides.json only references ids that still exist in the catalog', () => {
    // enrichment_confidence never rises from an override (see build-catalog.ts
    // step 5), and not every low-confidence row gets one — docs/overrides-
    // proposal.md documents 52 of 138 corrected and 86 reviewed and left as
    // rule output on purpose. What this guards is the file going stale: an id
    // an upstream dataset update removed would otherwise throw at build time
    // (loadOverrides already enforces that) without a test failing first.
    const overrides = existsSync(OVERRIDES_PATH)
      ? (JSON.parse(readFileSync(OVERRIDES_PATH, 'utf-8')) as Record<string, unknown>)
      : {};
    const catalogIds = new Set(
      (db.prepare('SELECT id FROM exercises').all() as { id: string }[]).map((r) => r.id),
    );
    const stale = Object.keys(overrides).filter((id) => !catalogIds.has(id));
    expect(stale).toEqual([]);
  });
});
