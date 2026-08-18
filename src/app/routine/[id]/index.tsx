import { inArray } from 'drizzle-orm';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  deleteRoutine,
  exerciseName,
  exercises,
  startSession,
  useCatalogDb,
  useRoutine,
  useRoutineDetail,
  useUserDb,
  type ExerciseRow as ExerciseRowType,
  type RoutineDayWithExercises,
  type RoutineExerciseRow,
} from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

/** Same three-way split as ExerciseEditorRow's field branch — which target
 *  field is populated already says how the set is measured (see
 *  defaultsFor() in routine-draft-editor.tsx), so the icon reads it the same
 *  way rather than needing the catalog's trackingType round-trip. */
function trackingIconFor(ex: RoutineExerciseRow): IconName {
  if (ex.targetDistanceMeters != null) return 'route';
  if (ex.targetDurationSeconds != null) return 'clock';
  return 'dumbbell';
}

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
  const [deleting, setDeleting] = useState(false);

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
      router.push(`/workout/${sessionId}`);
    } catch (err) {
      console.error('[routine/id] start session failed', err);
    } finally {
      setStartingDayId(null);
    }
  }

  function onEdit() {
    router.push(`/routine/${id}/edit`);
  }

  function onDelete() {
    if (!userDb || !routine) return;
    Alert.alert(t('routine.deleteConfirmTitle'), t('routine.deleteConfirmBody'), [
      { text: t('workout.cancel'), style: 'cancel' },
      {
        text: t('routine.delete'),
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try {
            await deleteRoutine(userDb, routine.id);
            router.replace('/routine');
          } catch (err) {
            console.error('[routine/id] delete failed', err);
            setDeleting(false);
          }
        },
      },
    ]);
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
          <View style={styles.titleRow}>
            <ThemedText type="sectionTitle" style={styles.titleText}>
              {routine.name}
            </ThemedText>
            <View style={styles.titleActions}>
              <PressableScale onPress={onEdit} accessibilityRole="button" accessibilityLabel={t('routine.edit')}>
                <Icon name="pencil" size={18} color={theme.accent} />
              </PressableScale>
              <PressableScale
                onPress={onDelete}
                disabled={deleting}
                accessibilityRole="button"
                accessibilityLabel={t('routine.delete')}
              >
                <Icon name="trash" size={18} color={theme.textSecondary} />
              </PressableScale>
            </View>
          </View>

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
                  <Icon name="play" size={12} color={theme.onAccent} />
                  <ThemedText type="small" style={{ color: theme.onAccent }}>
                    {t('routine.startWorkout')}
                  </ThemedText>
                </PressableScale>
              </View>

              {day.exercises.map((ex) => {
                const catalogExercise = exerciseById.get(ex.exerciseId);
                return (
                  <View key={ex.id} style={styles.exerciseRow}>
                    <Icon name={trackingIconFor(ex)} size={15} color={theme.textSecondary} />
                    <ThemedText type="small" numberOfLines={1} style={styles.exerciseName}>
                      {catalogExercise ? exerciseName(catalogExercise, locale) : ex.exerciseId}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {/* routine_exercises has no trackingType column of its own — which
                          field is populated already says how this set is measured, see
                          defaultsFor() in routine-draft-editor.tsx. */}
                      {ex.targetDistanceMeters != null
                        ? `${ex.targetSets} × ${ex.targetDistanceMeters}m`
                        : ex.targetDurationSeconds != null
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  titleText: { flex: 1 },
  titleActions: { flexDirection: 'row', gap: Spacing.three },
  dayCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
    ...CardShadow,
  },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
  },
  exerciseRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  exerciseName: { flex: 1 },
});
