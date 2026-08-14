/**
 * Runs against a real in-memory SQLite db via better-sqlite3 (same approach
 * as src/sync/drain.test.ts) — this is real PR-detection SQL (ordering,
 * SUM(), the weight-scoped filter), not logic worth trusting to a mock.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { outbox, personalRecords, sessionSets } from '@/db';
import type { UserDb } from '@/db';

import { logSet } from './use-workout-session';

// expo-crypto's native module isn't available under jest-expo's mocks (see
// the same workaround in src/sync/drain.test.ts) — logSet calls newId()
// internally for both the set row and each PR row, so it can't be bypassed
// here the way drain.test.ts bypasses enqueue().
let mockIdCounter = 0;
jest.mock('expo-crypto', () => ({
  randomUUID: () => `test-id-${++mockIdCounter}`,
}));

function makeTestDb(): UserDb {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
    CREATE TABLE session_sets (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      exercise_id TEXT NOT NULL,
      set_index INTEGER NOT NULL,
      weight_kg REAL,
      reps INTEGER,
      duration_seconds INTEGER,
      distance_meters REAL,
      is_warmup INTEGER NOT NULL DEFAULT 0,
      completed_at TEXT NOT NULL,
      deleted_at TEXT
    );
    CREATE TABLE personal_records (
      id TEXT PRIMARY KEY,
      exercise_id TEXT NOT NULL,
      type TEXT NOT NULL,
      value REAL NOT NULL,
      context_weight_kg REAL,
      achieved_at TEXT NOT NULL,
      session_set_id TEXT NOT NULL
    );
    CREATE TABLE outbox (
      id TEXT PRIMARY KEY,
      table_name TEXT NOT NULL,
      row_id TEXT NOT NULL,
      operation TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      synced_at TEXT
    );
  `);
  return drizzle(sqlite, { schema: { sessionSets, personalRecords, outbox } }) as unknown as UserDb;
}

function baseSet(overrides: Partial<Parameters<typeof logSet>[1]> = {}) {
  return {
    sessionId: 's1',
    exerciseId: 'ex1',
    setIndex: 0,
    weightKg: 10,
    reps: 10,
    durationSeconds: null,
    distanceMeters: null,
    isWarmup: false,
    ...overrides,
  };
}

test('volume PR is the session-cumulative total for that exercise, not one set', async () => {
  const db = makeTestDb();

  // First set: 10kg x 10 = 100kg this-session volume so far — a PR against
  // an empty history, so it registers.
  const first = await logSet(db, baseSet({ setIndex: 0 }));
  const firstVolume = first.find((pr) => pr.type === 'volume');
  expect(firstVolume?.value).toBe(100);

  // Second set, same session, same exercise: session volume is now
  // 100 + 100 = 200 — the bug this test guards against is this reading 100
  // again (this set's own volume) instead of the running total.
  const second = await logSet(db, baseSet({ setIndex: 1 }));
  const secondVolume = second.find((pr) => pr.type === 'volume');
  expect(secondVolume?.value).toBe(200);
});

test('a lighter set in a later session does not register a volume PR over a heavier session total', async () => {
  const db = makeTestDb();
  await logSet(db, baseSet({ sessionId: 's1', setIndex: 0, weightKg: 50, reps: 10 })); // session volume 500

  const later = await logSet(db, baseSet({ sessionId: 's2', setIndex: 0, weightKg: 10, reps: 5 })); // session volume 50
  expect(later.find((pr) => pr.type === 'volume')).toBeUndefined();
});

test('reps PR is scoped to the weight it was achieved at — a high rep count at a light weight does not beat a low rep count at a heavy weight, or vice versa', async () => {
  const db = makeTestDb();

  // 5 reps at 50kg — first time at this weight, registers.
  const heavy = await logSet(db, baseSet({ sessionId: 's1', setIndex: 0, weightKg: 50, reps: 5 }));
  expect(heavy.find((pr) => pr.type === 'reps')).toMatchObject({ value: 5, contextWeightKg: 50 });

  // 20 reps at 5kg — different weight entirely, first time at *this* weight,
  // also registers. Before the fix, this would have looked like it beat the
  // "5 reps" record on raw count alone.
  const light = await logSet(db, baseSet({ sessionId: 's1', setIndex: 1, weightKg: 5, reps: 20 }));
  expect(light.find((pr) => pr.type === 'reps')).toMatchObject({ value: 20, contextWeightKg: 5 });

  // 4 reps at 50kg — same weight as the first set, fewer reps: must not
  // register, regardless of the unrelated 20-rep record at 5kg.
  const heavyAgain = await logSet(db, baseSet({ sessionId: 's1', setIndex: 2, weightKg: 50, reps: 4 }));
  expect(heavyAgain.find((pr) => pr.type === 'reps')).toBeUndefined();

  // 6 reps at 50kg — same weight, beats the standing 5-rep record at that weight.
  const heavyBeaten = await logSet(db, baseSet({ sessionId: 's1', setIndex: 3, weightKg: 50, reps: 6 }));
  expect(heavyBeaten.find((pr) => pr.type === 'reps')).toMatchObject({ value: 6, contextWeightKg: 50 });
});

test('a warmup set never registers a PR of any kind', async () => {
  const db = makeTestDb();
  const result = await logSet(db, baseSet({ weightKg: 1000, reps: 100, isWarmup: true }));
  expect(result).toEqual([]);
});
