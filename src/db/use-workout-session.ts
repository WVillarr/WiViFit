import { and, desc, eq, isNull, ne, sql } from 'drizzle-orm';
import { useEffect, useState } from 'react';

import { writeAndEnqueue } from '@/sync';

import { newId } from './ids';
import { personalRecords, sessionSets, workoutSessions, type PersonalRecordRow } from './user-schema';
import { UserDb, useUserDb } from './user-client';

/** The session row itself — mainly for its routineDayId, to know which exercises belong to it. */
export function useWorkoutSession(sessionId: string | undefined) {
  const userDb = useUserDb();
  const [row, setRow] = useState<typeof workoutSessions.$inferSelect | null>(null);

  useEffect(() => {
    if (!userDb || !sessionId) return;
    let cancelled = false;
    userDb
      .select()
      .from(workoutSessions)
      .where(eq(workoutSessions.id, sessionId))
      .limit(1)
      .then((rows) => {
        if (!cancelled) setRow(rows[0] ?? null);
      })
      .catch((err) => console.error('[workout-session] load failed', err));
    return () => {
      cancelled = true;
    };
  }, [userDb, sessionId]);

  return row;
}

export async function startSession(userDb: UserDb, routineDayId: string | null): Promise<string> {
  const id = newId();
  const row = {
    id,
    routineDayId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    totalVolumeKg: null,
    deletedAt: null,
  };
  await writeAndEnqueue(userDb, 'workout_sessions', id, 'insert', row, () =>
    userDb.insert(workoutSessions).values(row),
  );
  return id;
}

export interface LogSetInput {
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  weightKg: number | null;
  reps: number | null;
  durationSeconds: number | null;
  distanceMeters: number | null;
  isWarmup: boolean;
}

/** Epley formula — the standard estimate when a true 1RM attempt isn't what's being trained. */
function estimated1Rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

/**
 * Writes the set, then checks it against the exercise's best known
 * personal_records and inserts a new one for each metric it beats. Warmup
 * sets never count — a warmup weight beating an old top set would be a false
 * record. Returns the PRs achieved so the workout screen can celebrate them
 * inline instead of the summary screen re-deriving the same query.
 */
export async function logSet(userDb: UserDb, input: LogSetInput): Promise<PersonalRecordRow[]> {
  const setId = newId();
  const now = new Date().toISOString();
  const setRow = {
    id: setId,
    sessionId: input.sessionId,
    exerciseId: input.exerciseId,
    setIndex: input.setIndex,
    weightKg: input.weightKg,
    reps: input.reps,
    durationSeconds: input.durationSeconds,
    distanceMeters: input.distanceMeters,
    isWarmup: input.isWarmup,
    completedAt: now,
    deletedAt: null,
  };
  await writeAndEnqueue(userDb, 'session_sets', setId, 'insert', setRow, () =>
    userDb.insert(sessionSets).values(setRow),
  );

  if (input.isWarmup || input.weightKg == null || input.reps == null || input.reps <= 0) {
    return [];
  }

  const candidates: { type: PersonalRecordRow['type']; value: number }[] = [
    { type: 'estimated_1rm', value: estimated1Rm(input.weightKg, input.reps) },
    { type: 'volume', value: input.weightKg * input.reps },
    { type: 'reps', value: input.reps },
  ];

  // A beaten record's old row is left in place rather than deleted or
  // updated in place — personal_records is a history (Fase 5's achievements
  // can show "you've broken this 4 times"), and the query below already
  // finds the current best by MAX(value), so old rows never resurface as if
  // they were still the record.
  const achieved: PersonalRecordRow[] = [];
  for (const candidate of candidates) {
    const [best] = await userDb
      .select()
      .from(personalRecords)
      .where(and(eq(personalRecords.exerciseId, input.exerciseId), eq(personalRecords.type, candidate.type)))
      .orderBy(desc(personalRecords.value))
      .limit(1);

    if (best && best.value >= candidate.value) continue;

    const prId = newId();
    const prRow = {
      id: prId,
      exerciseId: input.exerciseId,
      type: candidate.type,
      value: candidate.value,
      achievedAt: now,
      sessionSetId: setId,
    };
    await writeAndEnqueue(userDb, 'personal_records', prId, 'insert', prRow, () =>
      userDb.insert(personalRecords).values(prRow),
    );
    achieved.push(prRow);
  }

  return achieved;
}

/** Closes out the session and returns the computed volume, so the summary
 *  screen doesn't need a second round-trip to read back what this just wrote. */
export async function finishSession(userDb: UserDb, sessionId: string): Promise<{ totalVolumeKg: number }> {
  const [{ totalVolumeKg }] = await userDb
    .select({
      totalVolumeKg: sql<number>`COALESCE(SUM(${sessionSets.weightKg} * ${sessionSets.reps}), 0)`,
    })
    .from(sessionSets)
    .where(and(eq(sessionSets.sessionId, sessionId), isNull(sessionSets.deletedAt)));

  const endedAt = new Date().toISOString();
  await writeAndEnqueue(
    userDb,
    'workout_sessions',
    sessionId,
    'update',
    { endedAt, totalVolumeKg },
    () =>
      userDb
        .update(workoutSessions)
        .set({ endedAt, totalVolumeKg })
        .where(eq(workoutSessions.id, sessionId)),
  );

  return { totalVolumeKg };
}

/**
 * The most recent completed set for this exercise from a *different*
 * session — what the workout screen prefills as "same as last time". Scoped
 * to reps-tracked sets only; time/distance exercises don't have a
 * weight/reps pair to suggest.
 */
export async function lastSetForExercise(userDb: UserDb, exerciseId: string, excludingSessionId: string) {
  const [row] = await userDb
    .select()
    .from(sessionSets)
    .where(
      and(
        eq(sessionSets.exerciseId, exerciseId),
        ne(sessionSets.sessionId, excludingSessionId),
        eq(sessionSets.isWarmup, false),
        isNull(sessionSets.deletedAt),
      ),
    )
    .orderBy(desc(sessionSets.completedAt))
    .limit(1);
  return row ?? null;
}

export async function setsForSession(userDb: UserDb, sessionId: string) {
  return userDb
    .select()
    .from(sessionSets)
    .where(and(eq(sessionSets.sessionId, sessionId), isNull(sessionSets.deletedAt)))
    .orderBy(sessionSets.completedAt);
}
