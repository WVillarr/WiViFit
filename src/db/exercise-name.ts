import type { SupportedLocale } from '@/i18n';

import type { ExerciseListItem } from './catalog-schema';

/**
 * Not every English name resolves through scripts/exercise-names-es.ts (see
 * `nameEs`'s comment in catalog-schema.ts) — falling back to the English name
 * beats showing a blank title for the exercises still in
 * catalog-names-review.csv.
 */
export function exerciseName(item: Pick<ExerciseListItem, 'name' | 'nameEs'>, locale: SupportedLocale): string {
  return (locale === 'es' && item.nameEs) || item.name;
}
