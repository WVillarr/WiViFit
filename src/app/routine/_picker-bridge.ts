import type { ExerciseRow } from '@/db';

/**
 * Expo Router has no built-in "return a value from a pushed screen" —
 * unlike React Navigation's `navigate(name, { onSelect })`, params only flow
 * forward. This is the smallest thing that closes that loop: routine/new.tsx
 * stores a callback here right before pushing the picker, the picker calls it
 * with the chosen exercise and pops itself. Module-level rather than a
 * context/store because exactly one picker can be open at a time — there's
 * nothing here that needs to survive a screen unmount either.
 */
let pendingPick: ((exercise: ExerciseRow) => void) | null = null;

export function requestExercisePick(onPick: (exercise: ExerciseRow) => void): void {
  pendingPick = onPick;
}

export function resolveExercisePick(exercise: ExerciseRow): void {
  pendingPick?.(exercise);
  pendingPick = null;
}
