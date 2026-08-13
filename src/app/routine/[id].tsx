import { inArray } from 'drizzle-orm';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  exerciseName,
  exercises,
  startSession,
  useCatalogDb,
  useRoutine,
  useRoutineDetail,
  useUserDb,
  type ExerciseRow as ExerciseRowType,
  type RoutineDayWithExercises,
} from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

export default function RoutineDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routine = useRoutine(id);
  const { days, loading } = useRoutineDetail(id);
  const catalogDb = useCatalogDb();
  const userDb = useUserDb();
  const theme = useTheme();
  const { t, locale } = useTranslation();

  const [exerciseById, setExerciseById] = useState<Map<string, ExerciseRowType>>(new Map());
  const [startingDayId, setStartingDayId] = useState<string | null>(null);

  // Days/exercises only store exerciseId; names and trackingType live in
  // catalog.db, hydrated once per day-list change — same split as
  // use-favorites.ts's hydrate().
  useEffect(() => {
    const ids = Array.from(new Set(days.flatMap((d) => d.exercises.map((e) => e.exerciseId))));
    if (ids.length === 0) return;
    catalogDb
      .select()
      .from(exercises)
      .where(inArray(exercises.id, ids))
      .then((rows) => setExerciseById(new Map(rows.map((r) => [r.id, r]))))
      .catch((err) => console.error('[routine/id] exercise hydrate failed', err));
  }, [catalogDb, days]);

  async function onStartDay(day: RoutineDayWithExercises) {
    if (!userDb || startingDayId) return;
    setStartingDayId(day.id);
    try {
      const sessionId = await startSession(userDb, day.id);
      // `as Href`: same typed-routes gap as routine/index.tsx's push, for
      // the equally-freshly-added `workout/[sessionId]` route.
      router.push(`/workout/${sessionId}` as Href);
    } catch (err) {
      console.error('[routine/id] start session failed', err);
    } finally {
      setStartingDayId(null);
    }
  }

  if (loading || !routine) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']} />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedText type="sectionTitle">{routine.name}</ThemedText>

          {days.map((day) => (
            <ThemedView
              key={day.id}
              type="backgroundElement"
              style={[styles.dayCard, { borderColor: theme.border }]}
            >
              <View style={styles.dayHeaderRow}>
                <ThemedText type="smallBold">{day.name}</ThemedText>
                <PressableScale
                  onPress={() => onStartDay(day)}
                  disabled={startingDayId === day.id}
                  scaleTo={0.96}
                  accessibilityRole="button"
                  style={[styles.startButton, { backgroundColor: theme.accent }]}
                >
                  <ThemedText type="small" style={{ color: theme.onAccent }}>
                    {t('routine.startWorkout')}
                  </ThemedText>
                </PressableScale>
              </View>

              {day.exercises.map((ex) => {
                const catalogExercise = exerciseById.get(ex.exerciseId);
                return (
                  <View key={ex.id} style={styles.exerciseRow}>
                    <ThemedText type="small" numberOfLines={1} style={styles.exerciseName}>
                      {catalogExercise ? exerciseName(catalogExercise, locale) : ex.exerciseId}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {/* routine_exercises has no trackingType column of its own — which
                          field is populated already says how this set is measured, see
                          defaultsFor() in routine/new.tsx. */}
                      {ex.targetDurationSeconds != null
                        ? `${ex.targetSets} × ${ex.targetDurationSeconds}s`
                        : `${ex.targetSets} × ${ex.repRangeMin}-${ex.repRangeMax}`}
                    </ThemedText>
                  </View>
                );
              })}
            </ThemedView>
          ))}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scrollContent: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  dayCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startButton: { paddingHorizontal: Spacing.two + 2, paddingVertical: Spacing.one + 2, borderRadius: Radius.pill },
  exerciseRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  exerciseName: { flex: 1 },
});
