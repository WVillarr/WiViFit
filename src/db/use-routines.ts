import { and, desc, eq, isNull } from 'drizzle-orm';
import { useCallback, useEffect, useState } from 'react';

import { writeAndEnqueue } from '@/sync';

import { newId } from './ids';
import type { TrackingType } from './enrichment-types';
import { routineDays, routineExercises, routines } from './user-schema';
import { UserDb, useUserDb } from './user-client';

/** In-memory shape while a routine is being built — nothing here is written
 *  until Save, so an exercise added and then removed never touches the db. */
export interface DraftExercise {
  /** Local-only key for list rendering/removal — replaced by a real id on save. */
  draftId: string;
  exerciseId: string;
  name: string;
  trackingType: TrackingType;
  targetSets: number;
  repRangeMin: number | null;
  repRangeMax: number | null;
  targetDurationSeconds: number | null;
  targetDistanceMeters: number | null;
  restSeconds: number;
}

export interface DraftDay {
  draftId: string;
  name: string;
  exercises: DraftExercise[];
}

export interface RoutineDraft {
  name: string;
  days: DraftDay[];
}

/**
 * Inserts a draft's days and their exercises under an already-existing
 * `routineId` — the shared tail of both `createRoutine` (fresh routine row)
 * and `updateRoutine` (existing routine row, old days tombstoned first).
 * Every insert goes through `writeAndEnqueue` so the outbox has a row for
 * each one (see src/sync/outbox.ts). Not a single `.transaction()` call
 * wrapping all of it: the expo-sqlite Drizzle driver's transaction API is
 * sync-only and breaks on web (see the comment on writeAndEnqueue) — the
 * small risk of a crash mid-save leaving a partial routine is accepted for
 * the same reason it is there.
 */
async function insertDays(userDb: UserDb, routineId: string, days: DraftDay[]): Promise<void> {
  for (const [dayIndex, day] of days.entries()) {
    const dayId = newId();
    const dayRow = {
      id: dayId,
      routineId,
      dayIndex,
      name: day.name,
      budgetMinutes: null,
      updatedAt: new Date().toISOString(),
      deletedAt: null,
    };
    await writeAndEnqueue(userDb, 'routine_days', dayId, 'insert', dayRow, () =>
      userDb.insert(routineDays).values(dayRow),
    );

    for (const [orderIndex, ex] of day.exercises.entries()) {
      const exId = newId();
      const exRow = {
        id: exId,
        routineDayId: dayId,
        exerciseId: ex.exerciseId,
        orderIndex,
        targetSets: ex.targetSets,
        repRangeMin: ex.repRangeMin,
        repRangeMax: ex.repRangeMax,
        targetDurationSeconds: ex.targetDurationSeconds,
        targetDistanceMeters: ex.targetDistanceMeters,
        restSeconds: ex.restSeconds,
        updatedAt: new Date().toISOString(),
        deletedAt: null,
      };
      await writeAndEnqueue(userDb, 'routine_exercises', exId, 'insert', exRow, () =>
        userDb.insert(routineExercises).values(exRow),
      );
    }
  }
}

export async function createRoutine(userDb: UserDb, draft: RoutineDraft): Promise<string> {
  const routineId = newId();
  const now = new Date().toISOString();

  const routineRow = {
    id: routineId,
    name: draft.name,
    splitType: null,
    daysPerWeek: draft.days.length,
    isActive: false,
    source: 'manual' as const,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  await writeAndEnqueue(userDb, 'routines', routineId, 'insert', routineRow, () =>
    userDb.insert(routines).values(routineRow),
  );

  await insertDays(userDb, routineId, draft.days);
  return routineId;
}

/**
 * Editing replaces the day/exercise structure wholesale rather than diffing
 * row by row: every existing day and exercise for this routine is
 * tombstoned, then the draft's days are inserted fresh under the same
 * `routineId` (see insertDays above). This never touches history — past
 * `workout_sessions`/`session_sets` reference a `routineDayId`/`exerciseId`
 * by value, not through a live join filtered on `deletedAt`, so a completed
 * workout still reads back correctly after the routine that generated it
 * has since been edited or its days replaced.
 */
export async function updateRoutine(
  userDb: UserDb,
  routineId: string,
  draft: RoutineDraft,
): Promise<void> {
  const now = new Date().toISOString();

  const existingDays = await userDb
    .select({ id: routineDays.id })
    .from(routineDays)
    .where(and(eq(routineDays.routineId, routineId), isNull(routineDays.deletedAt)));

  for (const day of existingDays) {
    const existingExercises = await userDb
      .select({ id: routineExercises.id })
      .from(routineExercises)
      .where(and(eq(routineExercises.routineDayId, day.id), isNull(routineExercises.deletedAt)));

    for (const ex of existingExercises) {
      const patch = { deletedAt: now, updatedAt: now };
      await writeAndEnqueue(userDb, 'routine_exercises', ex.id, 'update', patch, () =>
        userDb.update(routineExercises).set(patch).where(eq(routineExercises.id, ex.id)),
      );
    }
    const patch = { deletedAt: now, updatedAt: now };
    await writeAndEnqueue(userDb, 'routine_days', day.id, 'update', patch, () =>
      userDb.update(routineDays).set(patch).where(eq(routineDays.id, day.id)),
    );
  }

  const routinePatch = { name: draft.name, daysPerWeek: draft.days.length, updatedAt: now };
  await writeAndEnqueue(userDb, 'routines', routineId, 'update', routinePatch, () =>
    userDb.update(routines).set(routinePatch).where(eq(routines.id, routineId)),
  );

  await insertDays(userDb, routineId, draft.days);
}

/** Tombstone, never a real DELETE — see deletedAt's doc comment on `routines`
 *  in user-schema.ts. Only the routine row itself: its days/exercises are
 *  never read except through a route that already requires a non-deleted
 *  parent, so leaving them alive is harmless and this stays a single write. */
export async function deleteRoutine(userDb: UserDb, routineId: string): Promise<void> {
  const deletedAt = new Date().toISOString();
  const patch = { deletedAt, updatedAt: deletedAt };
  await writeAndEnqueue(userDb, 'routines', routineId, 'update', patch, () =>
    userDb.update(routines).set(patch).where(eq(routines.id, routineId)),
  );
}

/** Rows for "my routines" — not-deleted, most recently updated first. */
export function useRoutines() {
  const userDb = useUserDb();
  const [rows, setRows] = useState<(typeof routines.$inferSelect)[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    if (!userDb) return;
    userDb
      .select()
      .from(routines)
      .where(isNull(routines.deletedAt))
      .orderBy(desc(routines.updatedAt))
      .then((r) => {
        setRows(r);
        setLoading(false);
      })
      .catch((err) => console.error('[routines] load failed', err));
  }, [userDb]);

  useEffect(reload, [reload]);

  return { routines: rows, loading, reload };
}

export type RoutineDayWithExercises = typeof routineDays.$inferSelect & {
  exercises: (typeof routineExercises.$inferSelect)[];
};

/** One day's exercises, ordered — what the workout screen (workout/[sessionId].tsx) steps through. */
export function useRoutineDayExercises(routineDayId: string | null) {
  const userDb = useUserDb();
  // `loadedFor` tracks which routineDayId `rows` was fetched for, so
  // `loading` can be *derived* by comparing it to the current id instead of
  // ever being set synchronously inside the effect body (the null/no-db
  // branch included) — a direct setState there risks a cascading render,
  // same class of fix as the Fase 1 catalog hooks.
  const [state, setState] = useState<{
    loadedFor: string | null;
    rows: (typeof routineExercises.$inferSelect)[];
  }>({ loadedFor: null, rows: [] });

  useEffect(() => {
    if (!userDb || !routineDayId) return;
    let cancelled = false;
    userDb
      .select()
      .from(routineExercises)
      .where(
        and(eq(routineExercises.routineDayId, routineDayId), isNull(routineExercises.deletedAt)),
      )
      .orderBy(routineExercises.orderIndex)
      .then((r) => {
        if (!cancelled) setState({ loadedFor: routineDayId, rows: r });
      })
      .catch((err) => console.error('[routines] day exercises load failed', err));
    return () => {
      cancelled = true;
    };
  }, [userDb, routineDayId]);

  const loading = routineDayId != null && state.loadedFor !== routineDayId;
  return { exercises: loading ? [] : state.rows, loading };
}

/** A single routine's own row — the name/daysPerWeek header above its days on routine/[id].tsx. */
export function useRoutine(routineId: string | undefined) {
  const userDb = useUserDb();
  const [row, setRow] = useState<typeof routines.$inferSelect | null>(null);

  useEffect(() => {
    if (!userDb || !routineId) return;
    let cancelled = false;
    userDb
      .select()
      .from(routines)
      .where(eq(routines.id, routineId))
      .limit(1)
      .then((rows) => {
        if (!cancelled) setRow(rows[0] ?? null);
      })
      .catch((err) => console.error('[routines] single load failed', err));
    return () => {
      cancelled = true;
    };
  }, [userDb, routineId]);

  return row;
}

/** A routine's days + exercises, ordered — what the workout screen needs to start a session. */
export function useRoutineDetail(routineId: string | undefined) {
  const userDb = useUserDb();
  const [days, setDays] = useState<RoutineDayWithExercises[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userDb || !routineId) return;
    let cancelled = false;

    async function run() {
      const dayRows = await userDb!
        .select()
        .from(routineDays)
        .where(and(eq(routineDays.routineId, routineId!), isNull(routineDays.deletedAt)))
        .orderBy(routineDays.dayIndex);

      const withExercises = await Promise.all(
        dayRows.map(async (day) => ({
          ...day,
          exercises: await userDb!
            .select()
            .from(routineExercises)
            .where(
              and(eq(routineExercises.routineDayId, day.id), isNull(routineExercises.deletedAt)),
            )
            .orderBy(routineExercises.orderIndex),
        })),
      );

      if (!cancelled) {
        setDays(withExercises);
        setLoading(false);
      }
    }

    run().catch((err) => console.error('[routines] detail load failed', err));
    return () => {
      cancelled = true;
    };
  }, [userDb, routineId]);

  return { days, loading };
}
