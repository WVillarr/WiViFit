import { inArray } from 'drizzle-orm';
import { router, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { RoutineDaysEditor, useRoutineDraft } from '@/components/routine-draft-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  exerciseName,
  exercises,
  updateRoutine,
  useCatalogDb,
  useRoutine,
  useRoutineDetail,
  useUserDb,
  type DraftDay,
  type ExerciseRow as ExerciseRowType,
} from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

/**
 * Loads the routine and gates on it being fully hydrated (including catalog
 * exercise names) before mounting RoutineEditForm below — useRoutineDraft's
 * initial state is only read on its very first render, so the form can't be
 * mounted until the real initialName/initialDays are already in hand.
 */
export default function EditRoutineScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const routine = useRoutine(id);
  const { days, loading } = useRoutineDetail(id);
  const catalogDb = useCatalogDb();
  const { locale } = useTranslation();
  const [exerciseById, setExerciseById] = useState<Map<string, ExerciseRowType>>(new Map());
  const idsNeeded = Array.from(new Set(days.flatMap((d) => d.exercises.map((e) => e.exerciseId))));
  // Derived, not a separate setState the effect below would have to trigger
  // synchronously for the "no exercises yet" case — see the cascading-render
  // note on useRoutineDayExercises's `loading` in use-routines.ts.
  const namesReady = idsNeeded.every((id) => exerciseById.has(id));

  useEffect(() => {
    const ids = Array.from(new Set(days.flatMap((d) => d.exercises.map((e) => e.exerciseId))));
    if (ids.length === 0) return;
    catalogDb
      .select()
      .from(exercises)
      .where(inArray(exercises.id, ids))
      .then((rows) => setExerciseById(new Map(rows.map((r) => [r.id, r]))))
      .catch((err) => console.error('[routine/edit] exercise hydrate failed', err));
  }, [catalogDb, days]);

  if (loading || !routine || !namesReady || !id) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']} />
      </ThemedView>
    );
  }

  const initialDays: DraftDay[] = days.map((day) => ({
    draftId: day.id,
    name: day.name,
    exercises: day.exercises.map((ex) => {
      const catalogExercise = exerciseById.get(ex.exerciseId);
      return {
        draftId: ex.id,
        exerciseId: ex.exerciseId,
        name: catalogExercise ? exerciseName(catalogExercise, locale) : ex.exerciseId,
        trackingType: catalogExercise?.trackingType ?? 'reps',
        targetSets: ex.targetSets,
        repRangeMin: ex.repRangeMin,
        repRangeMax: ex.repRangeMax,
        targetDurationSeconds: ex.targetDurationSeconds,
        targetDistanceMeters: ex.targetDistanceMeters,
        restSeconds: ex.restSeconds,
      };
    }),
  }));

  return <RoutineEditForm routineId={id} initialName={routine.name} initialDays={initialDays} />;
}

function RoutineEditForm({
  routineId,
  initialName,
  initialDays,
}: {
  routineId: string;
  initialName: string;
  initialDays: DraftDay[];
}) {
  const userDb = useUserDb();
  const theme = useTheme();
  const { t } = useTranslation();
  const draft = useRoutineDraft(initialName, initialDays);
  const [saving, setSaving] = useState(false);

  const canSave = draft.name.trim().length > 0 && draft.days.some((d) => d.exercises.length > 0) && !saving;

  async function save() {
    if (!userDb || !canSave) return;
    setSaving(true);
    try {
      await updateRoutine(userDb, routineId, { name: draft.name.trim(), days: draft.days });
      router.replace(`/routine/${routineId}` as Href);
    } catch (err) {
      console.error('[routine/edit] save failed', err);
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="sectionTitle" style={styles.title}>
            {t('routine.editTitle')}
          </ThemedText>

          <TextInput
            value={draft.name}
            onChangeText={draft.setName}
            placeholder={t('routine.namePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.nameInput,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          />

          <RoutineDaysEditor
            days={draft.days}
            onRename={draft.renameDay}
            onRemoveDay={draft.removeDay}
            onAddExercise={draft.addExerciseTo}
            onRemoveExercise={draft.removeExercise}
            onUpdateExercise={draft.updateExercise}
            onAddDay={draft.addDay}
          />
        </ScrollView>

        <ThemedView style={[styles.saveBar, { borderTopColor: theme.border }]}>
          <PressableScale
            onPress={save}
            scaleTo={0.97}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            style={[styles.saveButton, { backgroundColor: canSave ? theme.accent : theme.backgroundSelected }]}
          >
            <ThemedText type="smallBold" style={{ color: canSave ? theme.onAccent : theme.textSecondary }}>
              {saving ? t('routine.saving') : t('routine.save')}
            </ThemedText>
          </PressableScale>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scrollContent: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  title: {},
  nameInput: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  saveBar: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
  },
});
