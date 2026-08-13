import { eq } from 'drizzle-orm';

import { outbox } from '@/db/user-schema';
import type { UserDb } from '@/db/user-client';

import { pendingOutbox } from './outbox';
import { getSyncRemote } from './remote';

/** Caps a single burst so one drain call can't hold the JS thread indefinitely on a huge backlog. */
const MAX_ROWS_PER_DRAIN = 200;
const MAX_RETRIES = 5;
const BASE_BACKOFF_MS = 1000;

interface RetryState {
  attempts: number;
  /** Row is skipped until Date.now() passes this — the exponential backoff. */
  nextAttemptAt: number;
}

const retryState = new Map<string, RetryState>();

/**
 * Sends every unsynced outbox row to `getSyncRemote()`, oldest first, one at
 * a time — not in parallel, since a later row can depend on an earlier one
 * having landed (e.g. a `session_sets` insert after its `workout_sessions`
 * insert). A row that keeps failing past MAX_RETRIES is left unsynced rather
 * than dropped: it'll retry on the next drain (app restart, reconnect) after
 * the in-memory backoff counter resets.
 *
 * No-ops with a console warning if no remote is configured yet (Fase 2
 * before Supabase — see remote.ts) rather than throwing, so calling this
 * unconditionally on reconnect is always safe.
 */
export async function drain(userDb: UserDb): Promise<{ sent: number; failed: number }> {
  const remote = getSyncRemote();
  if (!remote) {
    console.warn('[sync] drain() called with no remote configured — skipping');
    return { sent: 0, failed: 0 };
  }

  const rows = (await pendingOutbox(userDb)).slice(0, MAX_ROWS_PER_DRAIN);
  let sent = 0;
  let failed = 0;
  const now = Date.now();

  for (const row of rows) {
    const state = retryState.get(row.id);
    if (state && (state.attempts >= MAX_RETRIES || now < state.nextAttemptAt)) {
      failed++;
      continue;
    }
    try {
      await remote.push(row);
      await userDb.update(outbox).set({ syncedAt: new Date().toISOString() }).where(eq(outbox.id, row.id));
      retryState.delete(row.id);
      sent++;
    } catch (err) {
      const attempts = (state?.attempts ?? 0) + 1;
      retryState.set(row.id, { attempts, nextAttemptAt: now + BASE_BACKOFF_MS * 2 ** (attempts - 1) });
      failed++;
      console.error(`[sync] push failed for outbox row ${row.id} (attempt ${attempts})`, err);
      break; // preserve delivery order: don't send row N+1 before row N is confirmed
    }
  }

  return { sent, failed };
}
