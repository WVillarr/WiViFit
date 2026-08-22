import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';

import { outbox, routines, syncState } from '@/db';
import type { UserDb } from '@/db';

import { setSyncRemote } from './remote';
import { syncNow } from './sync-now';

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
    CREATE TABLE sync_state (key TEXT PRIMARY KEY, cursor TEXT);
    CREATE TABLE routines (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      split_type TEXT,
      days_per_week INTEGER NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted_at TEXT
    );
  `);
  return drizzle(sqlite, { schema: { outbox, syncState, routines } }) as unknown as UserDb;
}

afterEach(() => setSyncRemote(null));

test('syncNow applies newer remote rows and preserves newer local rows', async () => {
  const db = makeTestDb();
  await db.insert(routines).values({
    id: 'r1',
    name: 'Local newer',
    splitType: null,
    daysPerWeek: 1,
    isActive: false,
    source: 'manual',
    createdAt: '2026-08-20T10:00:00.000Z',
    updatedAt: '2026-08-20T12:00:00.000Z',
    deletedAt: null,
  });

  setSyncRemote({
    push: async () => undefined,
    pull: async () => [
      {
        tableName: 'routines',
        row: {
          id: 'r1',
          name: 'Remote older',
          splitType: null,
          daysPerWeek: 1,
          isActive: false,
          source: 'manual',
          createdAt: '2026-08-20T10:00:00.000Z',
          updatedAt: '2026-08-20T11:00:00.000Z',
          deletedAt: null,
        },
      },
      {
        tableName: 'routines',
        row: {
          id: 'r2',
          name: 'Remote new',
          splitType: null,
          daysPerWeek: 2,
          isActive: false,
          source: 'manual',
          createdAt: '2026-08-20T10:00:00.000Z',
          updatedAt: '2026-08-20T13:00:00.000Z',
          deletedAt: null,
        },
      },
    ],
  });

  const result = await syncNow(db);
  const rows = await db.select().from(routines);

  expect(result).toEqual({ sent: 0, received: 2 });
  expect(rows).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ id: 'r1', name: 'Local newer' }),
      expect.objectContaining({ id: 'r2', name: 'Remote new' }),
    ]),
  );
  expect(await db.select().from(syncState)).toEqual([
    { key: 'remote', cursor: '2026-08-20T13:00:00.000Z' },
  ]);
});
