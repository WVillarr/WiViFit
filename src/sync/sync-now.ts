import { eq } from 'drizzle-orm';

import {
  personalRecords,
  routineDays,
  routineExercises,
  routines,
  sessionSets,
  syncState,
  workoutSessions,
} from '@/db/user-schema';
import type { UserDb } from '@/db';

import { drain } from './drain';
import { getSyncRemote } from './remote';

const CURSOR_KEY = 'remote';

const TABLES = {
  routines,
  routine_days: routineDays,
  routine_exercises: routineExercises,
  workout_sessions: workoutSessions,
  session_sets: sessionSets,
  personal_records: personalRecords,
} as const;

type SyncTableName = keyof typeof TABLES;

function isSyncTableName(value: string): value is SyncTableName {
  return value in TABLES;
}

async function applyRemoteChange(
  userDb: UserDb,
  tableName: string,
  row: Record<string, unknown>,
): Promise<void> {
  if (
    !isSyncTableName(tableName) ||
    typeof row.id !== 'string' ||
    typeof row.updatedAt !== 'string'
  )
    return;

  const table = TABLES[tableName] as any;
  const [current] = await userDb.select().from(table).where(eq(table.id, row.id)).limit(1);
  if (current?.updatedAt && current.updatedAt >= row.updatedAt) return;

  if (current) {
    await userDb.update(table).set(row).where(eq(table.id, row.id));
  } else {
    await userDb.insert(table).values(row);
  }
}

/** Pushes local mutations first, then applies newer remote rows without echoing them into the outbox. */
export async function syncNow(userDb: UserDb): Promise<{ sent: number; received: number }> {
  const remote = getSyncRemote();
  if (!remote) return { sent: 0, received: 0 };

  const pushed = await drain(userDb);
  if (!remote.pull) return { sent: pushed.sent, received: 0 };

  const [state] = await userDb
    .select()
    .from(syncState)
    .where(eq(syncState.key, CURSOR_KEY))
    .limit(1);
  const changes = await remote.pull(state?.cursor ?? null);
  let cursor = state?.cursor ?? null;

  for (const change of changes) {
    await applyRemoteChange(userDb, change.tableName, change.row);
    const updatedAt = change.row.updatedAt;
    if (typeof updatedAt === 'string' && (!cursor || updatedAt > cursor)) cursor = updatedAt;
  }

  if (cursor) {
    await userDb
      .insert(syncState)
      .values({ key: CURSOR_KEY, cursor })
      .onConflictDoUpdate({ target: syncState.key, set: { cursor } });
  }

  return { sent: pushed.sent, received: changes.length };
}
