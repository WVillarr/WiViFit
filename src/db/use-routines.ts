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
 * Persists a full routine as one write path: the routine row, then each day,
 * then each exercise — every insert goes through `writeAndEnqueue` so the
 * outbox has a row for each one (see src/sync/outbox.ts). Not a single
 * `.transaction()` call wrapping all of it: the expo-sqlite Drizzle driver's
 * transaction API is sync-only and breaks on web (see the comment on
 * writeAndEnqueue) — the small risk of a crash mid-save leaving a partial
 * routine is accepted for the same reason it is there.
 */
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

  for (const [dayIndex, day] of draft.days.entries()) {
    const dayId = newId();
    const dayRow = {
      id: dayId,
      routineId,
      dayIndex,
      name: day.name,
      budgetMinutes: null,
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
        restSeconds: ex.restSeconds,
        deletedAt: null,
      };
      await writeAndEnqueue(userDb, 'routine_exercises', exId, 'insert', exRow, () =>
        userDb.insert(routineExercises).values(exRow),
      );
    }
  }

  return routineId;
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
      .where(and(eq(routineExercises.routineDayId, routineDayId), isNull(routineExercises.deletedAt)))
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
            .where(and(eq(routineExercises.routineDayId, day.id), isNull(routineExercises.deletedAt)))
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
