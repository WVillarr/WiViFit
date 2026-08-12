import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { secondaryPlateTargets } from '@/db/secondary-muscles';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

import { BODY_MAP_BASE_HEIGHT, MuscleBodyMap } from './muscle-body-map';

/** Small enough for two plates to sit side by side on a phone. */
const PLATE_HEIGHT = 210;

interface ExerciseAnatomyProps {
  target: string;
  secondaryMuscles: string[];
}

/**
 * Front and back plates on the exercise card, primary in the accent and
 * assisting muscles in its soft tint.
 *
 * Read-only on purpose: this is the same component the exercises tab navigates
 * with, but here it answers "what does this work" rather than "what do I want
 * to work". Both sides show at once because an exercise's primary and assisting
 * muscles routinely straddle them — a row is back and biceps.
 */
export function ExerciseAnatomy({ target, secondaryMuscles }: ExerciseAnatomyProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  // The plate is keyed by `target` slugs, but secondary muscles come in the
  // dataset's own anatomical vocabulary — they need translating first or
  // nothing lights up.
  const plateTargets = useMemo(() => secondaryPlateTargets(secondaryMuscles), [secondaryMuscles]);

  return (
    <View style={styles.container}>
      <View style={styles.plates}>
        {(['front', 'back'] as const).map((view) => (
          <MuscleBodyMap
            key={view}
            view={view}
            selectedMuscle={target}
            secondaryMuscles={plateTargets}
            scale={PLATE_HEIGHT / BODY_MAP_BASE_HEIGHT}
          />
        ))}
      </View>

      <View style={styles.legend}>
        <LegendSwatch color={theme.accent} label={t('exercise.targetMuscle')} />
        {secondaryMuscles.length > 0 && (
          <LegendSwatch color={theme.accentSoft} label={t('exercise.secondaryMuscles')} />
        )}
      </View>
    </View>
  );
}

function LegendSwatch({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.swatch, { backgroundColor: color }]} />
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: Spacing.three },
  plates: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.four },
  legend: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.three },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  swatch: { width: 10, height: 10, borderRadius: 5 },
});
