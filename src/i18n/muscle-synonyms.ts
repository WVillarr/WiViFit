/**
 * Colloquial Spanish search terms → dataset `target` slug. The dataset only
 * has English muscle names (see AGENTS.md plan, Fase 1 "Diccionario
 * anatómico"), so a Spanish-speaking user typing "gemelos" would otherwise
 * get zero results. Matched against the full, trimmed, lowercased search box
 * text — not a per-word tokenizer — since these are short, common phrases.
 */
export const MUSCLE_SYNONYMS_ES: Record<string, string> = {
  gemelos: 'calves',
  pantorrillas: 'calves',
  'espalda ancha': 'lats',
  alas: 'lats',
  dorsales: 'lats',
  'espalda alta': 'upper_back',
  'parte de atras del brazo': 'triceps',
  'parte de atrás del brazo': 'triceps',
  triceps: 'triceps',
  'espalda baja': 'spine',
  lumbares: 'spine',
  riñones: 'spine',
  rinones: 'spine',
  trapa: 'traps',
  'cuello ancho': 'traps',
  cintura: 'abs',
  abdomen: 'abs',
  abdominales: 'abs',
  core: 'abs',
  pecho: 'pectorals',
  pectorales: 'pectorals',
  hombros: 'delts',
  deltoides: 'delts',
  gluteos: 'glutes',
  glúteos: 'glutes',
  piernas: 'quads',
  cuadriceps: 'quads',
  cuádriceps: 'quads',
  femorales: 'hamstrings',
  isquiotibiales: 'hamstrings',
  antebrazos: 'forearms',
  biceps: 'biceps',
  bíceps: 'biceps',
};

export function resolveMuscleSynonym(query: string): string | null {
  return MUSCLE_SYNONYMS_ES[query.trim().toLowerCase()] ?? null;
}
