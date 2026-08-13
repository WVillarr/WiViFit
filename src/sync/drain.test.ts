/**
 * Runs against a real in-memory SQLite db via better-sqlite3 (same approach
 * as scripts/catalog.test.ts) rather than a hand-rolled fake — expo-sqlite's
 * driver and better-sqlite3's driver both implement Drizzle's query builder
 * over the same schema, so this exercises real SQL (ordering, the `synced_at
 * IS NULL` filter, the update-on-success write) instead of a mock that could
 * quietly drift from what SQLite actually does.
 */
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { outbox } from '@/db';
import type { UserDb } from '@/db';

import { drain } from './drain';
import { enqueue, pendingOutbox } from './outbox';
import { setSyncRemote, type SyncRemote } from './remote';

/**
 * Inserts an outbox row with an explicit id, bypassing enqueue()'s
 * newId()/expo-crypto call — expo-crypto's native module isn't available
 * under jest-expo's mocks, so newId() can't be relied on here. The
 * round-trip test below exercises the real enqueue() separately; these tests
 * care about drain()'s behavior once a row exists, not about id generation.
 */
async function insertOutboxRow(db: UserDb, id: string, rowId: string) {
  await db
    .insert(outbox)
    .values({ id, tableName: 'routines', rowId, operation: 'insert', payloadJson: '{}', createdAt: new Date().toISOString() });
}

function makeTestDb(): UserDb {
  const sqlite = new Database(':memory:');
  sqlite.exec(`
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
  return drizzle(sqlite, { schema: { outbox } }) as unknown as UserDb;
}

afterEach(() => setSyncRemote(null as unknown as SyncRemote));

test('enqueue + pendingOutbox round-trips a row', async () => {
  const db = makeTestDb();
  await enqueue(db, 'routines', 'r1', 'insert', { name: 'Push day' });

  const pending = await pendingOutbox(db);
  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({ tableName: 'routines', rowId: 'r1', operation: 'insert' });
  expect(JSON.parse(pending[0].payloadJson)).toEqual({ name: 'Push day' });
});

test('drain marks a successfully pushed row as synced and stops draining it', async () => {
  const db = makeTestDb();
  await insertOutboxRow(db, 'ob-success', 'r1');
  const pushed: string[] = [];
  setSyncRemote({
    push: async (row) => {
      pushed.push(row.id);
    },
  });

  const result = await drain(db);

  expect(result).toEqual({ sent: 1, failed: 0 });
  expect(pushed).toHaveLength(1);
  expect(await pendingOutbox(db)).toHaveLength(0);
});

test('drain sends rows oldest-first and stops at the first failure', async () => {
  const db = makeTestDb();
  // Ids unique to this test: `retryState` in drain.ts is module-level and
  // outlives a single test, so reusing an id that failed in another test
  // would inherit its backoff window here.
  await insertOutboxRow(db, 'ob-order-1', 'r1');
  await insertOutboxRow(db, 'ob-order-2', 'r2');
  const attempts: string[] = [];
  setSyncRemote({
    push: async (row) => {
      attempts.push(row.rowId);
      throw new Error('network down');
    },
  });

  const result = await drain(db);

  // r1 is attempted and fails; r2 is never attempted this round, preserving
  // delivery order (a later row must never land before an earlier one) — so
  // the loop breaks after r1 rather than also counting r2 as failed.
  expect(attempts).toEqual(['r1']);
  expect(result).toEqual({ sent: 0, failed: 1 });
  expect(await pendingOutbox(db)).toHaveLength(2);
});

test('drain backs off a repeatedly-failing row instead of retrying every call', async () => {
  const db = makeTestDb();
  await insertOutboxRow(db, 'ob-backoff', 'r1');
  let attempts = 0;
  setSyncRemote({
    push: async () => {
      attempts++;
      throw new Error('still down');
    },
  });

  await drain(db);
  expect(attempts).toBe(1);

  // Immediately retrying without the backoff window elapsing must not
  // attempt again — this is what stops a dead remote from spinning the CPU.
  await drain(db);
  expect(attempts).toBe(1);
});

test('drain no-ops when no remote is configured', async () => {
  const db = makeTestDb();
  await insertOutboxRow(db, 'ob-no-remote', 'r1');

  const result = await drain(db);

  expect(result).toEqual({ sent: 0, failed: 0 });
  expect(await pendingOutbox(db)).toHaveLength(1);
});
