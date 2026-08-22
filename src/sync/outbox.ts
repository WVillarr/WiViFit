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
 * Runs `write` and enqueues its outbox entry in one SQLite transaction. Every mutation in the
 * routine/workout write path (src/db/use-routines.ts, use-workout-session.ts,
 * ...) should go through this rather than calling userDb.insert/update/delete
 * directly, so no write is ever made durable locally without also being
 * queued to sync.
 *
 * Drizzle's Expo driver exposes the underlying SQLite client as `$client` and
 * its sync query builders expose `.run()`. Keeping both statements inside
 * `withTransactionSync()` closes the only window where a local row could be
 * durable without its queue entry. The workout writes are tiny, so the brief
 * synchronous section is preferable to risking data loss.
 */
export async function writeAndEnqueue<T>(
  userDb: UserDb,
  tableName: string,
  rowId: string,
  operation: OutboxOperation,
  payload: unknown,
  write: () => T,
): Promise<T> {
  let result!: T;
  const createdAt = new Date().toISOString();
  const payloadJson = JSON.stringify(payload);
  const query = write as unknown as { (): T };

  const runTransaction = userDb.$client as unknown as {
    withTransactionSync?: (task: () => void) => void;
    transaction?: (task: () => void) => () => void;
  };
  const transactionBody = () => {
    const statement = query();
    const runnable = statement as T & { run?: () => unknown };
    if (typeof runnable.run !== 'function') {
      throw new Error('writeAndEnqueue requiere una consulta SQLite sync con .run().');
    }
    result = runnable.run() as T;
    userDb
      .insert(outbox)
      .values({ id: newId(), tableName, rowId, operation, payloadJson, createdAt, syncedAt: null })
      .run();
  };

  if (runTransaction.withTransactionSync) runTransaction.withTransactionSync(transactionBody);
  else if (runTransaction.transaction) runTransaction.transaction(transactionBody)();
  else transactionBody();

  return result;
}

/** Rows still waiting to reach the server, oldest first — the order `drain()` sends them in. */
export async function pendingOutbox(userDb: UserDb) {
  return userDb.select().from(outbox).where(isNull(outbox.syncedAt)).orderBy(asc(outbox.createdAt));
}
