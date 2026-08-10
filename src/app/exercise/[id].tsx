import { eq } from 'drizzle-orm';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { exerciseSecondaryMuscles, exercises, ExerciseRow, useCatalogDb } from '@/db';
import { useTranslation } from '@/i18n/use-translation';
import { mediaProvider } from '@/media';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useCatalogDb();
  const { t, locale } = useTranslation();

  const [exercise, setExercise] = useState<ExerciseRow | null>(null);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const [row] = await db.select().from(exercises).where(eq(exercises.id, id)).limit(1);
      const muscles = await db
        .select({ muscle: exerciseSecondaryMuscles.muscle })
        .from(exerciseSecondaryMuscles)
        .where(eq(exerciseSecondaryMuscles.exerciseId, id));
      if (!cancelled) {
        setExercise(row ?? null);
        setSecondaryMuscles(muscles.map((m) => m.muscle));
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [db, id]);

  if (!exercise) return null;

  const steps: string[] = JSON.parse(
    locale === 'es' ? exercise.instructionStepsEs : exercise.instructionStepsEn,
  );

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Image
        source={{ uri: mediaProvider.getGifUri(exercise.gifPath) }}
        style={styles.gif}
        contentFit="contain"
      />

      <ThemedText type="title" style={styles.title}>
        {exercise.name}
      </ThemedText>

      <ThemedView style={styles.metaRow}>
        <MetaChip label={t('exercise.targetMuscle')} value={t(`muscles.${exercise.target}`)} />
        <MetaChip label={t('exercise.equipment')} value={t(`equipment.${exercise.equipment}`)} />
        <MetaChip label={t('exercise.difficulty')} value={t(`difficulty.${exercise.difficulty}`)} />
      </ThemedView>

      {secondaryMuscles.length > 0 && (
        <ThemedView style={styles.section}>
          <ThemedText type="smallBold">{t('exercise.secondaryMuscles')}</ThemedText>
          <ThemedText themeColor="textSecondary">
            {secondaryMuscles.map((m) => t(`muscles.${m}`)).join(', ')}
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={styles.section}>
        <ThemedText type="smallBold">{t('exercise.instructions')}</ThemedText>
        {steps.map((step, i) => (
          <ThemedText key={i} style={styles.step}>
            {i + 1}. {step}
          </ThemedText>
        ))}
      </ThemedView>

      <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
        {t('exercise.attributionPrefix')} {exercise.attribution}
      </ThemedText>
    </ScrollView>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.metaChip}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.four,
  },
  gif: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Spacing.three,
  },
  title: {
    textTransform: 'capitalize',
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metaChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    gap: Spacing.half,
  },
  section: {
    gap: Spacing.two,
  },
  step: {
    lineHeight: 22,
  },
  attribution: {
    marginTop: Spacing.three,
  },
});
