import { eq } from 'drizzle-orm';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { exerciseSecondaryMuscles, exercises, ExerciseRow, useCatalogDb } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';
import { mediaProvider } from '@/media';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useCatalogDb();
  const theme = useTheme();
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
    <ScrollView contentContainerStyle={styles.scroll}>
      <ThemedView style={styles.content}>
        <Image
          source={{ uri: mediaProvider.getGifUri(exercise.gifPath) }}
          style={[styles.gif, { backgroundColor: theme.backgroundElement }]}
          contentFit="contain"
        />

        <ThemedText type="subtitle" style={styles.title}>
          {exercise.name}
        </ThemedText>

        <View style={styles.metaRow}>
          <MetaChip label={t('exercise.targetMuscle')} value={t(`muscles.${exercise.target}`)} />
          <MetaChip label={t('exercise.equipment')} value={t(`equipment.${exercise.equipment}`)} />
          <MetaChip
            label={t('exercise.difficulty')}
            value={t(`difficulty.${exercise.difficulty}`)}
          />
        </View>

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
            <View key={i} style={styles.stepRow}>
              <ThemedView style={[styles.stepBadge, { backgroundColor: theme.accentSoft }]}>
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  {i + 1}
                </ThemedText>
              </ThemedView>
              <ThemedText style={styles.stepText}>{step}</ThemedText>
            </View>
          ))}
        </ThemedView>

        <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
          {t('exercise.attributionPrefix')} {exercise.attribution}
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <ThemedView
      type="backgroundElement"
      style={[styles.metaChip, { borderColor: theme.border }]}
    >
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="smallBold">{value}</ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    maxWidth: MaxContentWidth,
    padding: Spacing.three,
    gap: Spacing.four,
  },
  gif: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: Radius.lg,
  },
  title: {
    textTransform: 'capitalize',
    lineHeight: 38,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  metaChip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.half,
  },
  section: {
    gap: Spacing.two,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    flex: 1,
    lineHeight: 24,
  },
  attribution: {
    marginTop: Spacing.two,
  },
});
