/**
 * Verifies the built assets/catalog.db against the Fase 1 acceptance
 * criteria. Runs against the real artifact with better-sqlite3 rather than a
 * fixture, so a broken pipeline fails here instead of on a device.
 */
import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import path from 'node:path';

import { TARGET_TO_SLUG } from '../src/components/body-map/muscle-slugs';
import { EQUIPMENT_GROUP_ORDER, equipmentValuesFor } from '../src/constants/equipment-groups';
import { FTS_BM25_WEIGHTS } from '../src/db/fts-weights';
import { SECONDARY_TO_TARGET } from '../src/db/secondary-muscles';
import en from '../src/i18n/translations/en.json';
import es from '../src/i18n/translations/es.json';

const DB_PATH = path.join(__dirname, '..', 'assets', 'catalog.db');

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

  test('FTS5 ranks a full exercise name above incidental matches', () => {
    const rows = db
      .prepare(
        `SELECT id, name FROM exercises_fts WHERE exercises_fts MATCH ?
         ORDER BY bm25(exercises_fts, ${FTS_BM25_WEIGHTS}) LIMIT 10`,
      )
      .all('"bench"* "press"*') as { id: string; name: string }[];

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.name.includes('bench') && r.name.includes('press'))).toBe(true);
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
});
