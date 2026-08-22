import type { ExerciseRow } from '@/db';

/**
 * Small bridge for returning one selected exercise from the picker screen.
 * Exactly one picker can be open at a time, so module state is sufficient.
 */
let pendingPick: ((exercise: ExerciseRow) => void) | null = null;

export function requestExercisePick(onPick: (exercise: ExerciseRow) => void): void {
  pendingPick = onPick;
}

export function resolveExercisePick(exercise: ExerciseRow): void {
  pendingPick?.(exercise);
  pendingPick = null;
}
