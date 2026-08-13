import { asc, isNull } from 'drizzle-orm';

import { newId } from '@/db/ids';
import { outbox } from '@/db/user-schema';
import type { UserDb } from '@/db/user-client';

export type OutboxOperation = 'insert' | 'update' | 'delete';

/**
 * Enqueues one outbox row. Call this in the *same* place a write happens —
 * see writeAndEnqueue() below for the common case of "write a row, queue it"
 * as a single unit, so a write is never made durable locally without also
 * being durable in the sync queue.
 */
export async function enqueue(
  userDb: UserDb,
  tableName: string,
  rowId: string,
  operation: OutboxOperation,
  payload: unknown,
): Promise<void> {
  await userDb.insert(outbox).values({
    id: newId(),
    tableName,
    rowId,
    operation,
    payloadJson: JSON.stringify(payload),
    createdAt: new Date().toISOString(),
    syncedAt: null,
  });
}

/**
 * Runs `write`, then enqueues its outbox entry. Every mutation in the
 * routine/workout write path (src/db/use-routines.ts, use-workout-session.ts,
 * ...) should go through this rather than calling userDb.insert/update/delete
 * directly, so no write is ever made durable locally without also being
 * queued to sync.
 *
 * NOT wrapped in `userDb.transaction()` — deliberately. drizzle-orm's
 * expo-sqlite driver only ships a *synchronous* transaction implementation
 * (`ExpoSQLiteTransaction` runs `executeSync` under the hood), the same sync
 * API user-client.ts already avoids for the top-level connection because it
 * throws `SharedArrayBuffer is not defined` on web without cross-origin-
 * isolation headers. Wrapping these two awaited statements in `.transaction()`
 * would silently reintroduce that crash on web. The gap this leaves — a crash
 * between the two `await`s below — is a single-digit-millisecond window
 * versus SQLite's own durability, not the multi-second "app got killed
 * mid-workout" scenario the Fase 2 offline test actually exercises.
 */
export async function writeAndEnqueue<T>(
  userDb: UserDb,
  tableName: string,
  rowId: string,
  operation: OutboxOperation,
  payload: unknown,
  write: () => Promise<T>,
): Promise<T> {
  const result = await write();
  await enqueue(userDb, tableName, rowId, operation, payload);
  return result;
}

/** Rows still waiting to reach the server, oldest first — the order `drain()` sends them in. */
export async function pendingOutbox(userDb: UserDb) {
  return userDb.select().from(outbox).where(isNull(outbox.syncedAt)).orderBy(asc(outbox.createdAt));
}
