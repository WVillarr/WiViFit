import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NumberField } from '@/components/number-field';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { createRoutine, exerciseName, newId, useUserDb } from '@/db';
import type { DraftDay, DraftExercise, RoutineDraft } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

import { requestExercisePick } from './_picker-bridge';

/**
 * Defaults chosen by trackingType, not a single "3x10" for everything — a
 * plank isn't a rep range and shouldn't be presented as one. See
 * exercises.trackingType in catalog-schema.ts (Fase 1's enrichment).
 */
function defaultsFor(trackingType: DraftExercise['trackingType']) {
  if (trackingType === 'time') {
    return { targetSets: 3, repRangeMin: null, repRangeMax: null, targetDurationSeconds: 30, restSeconds: 60 };
  }
  if (trackingType === 'distance') {
    return { targetSets: 1, repRangeMin: null, repRangeMax: null, targetDurationSeconds: null, restSeconds: 90 };
  }
  return { targetSets: 3, repRangeMin: 8, repRangeMax: 12, targetDurationSeconds: null, restSeconds: 90 };
}

function newDay(name: string): DraftDay {
  return { draftId: newId(), name, exercises: [] };
}

export default function NewRoutineScreen() {
  const userDb = useUserDb();
  const theme = useTheme();
  const { t, locale } = useTranslation();

  const [name, setName] = useState('');
  const [days, setDays] = useState<DraftDay[]>([newDay(t('routine.dayDefaultName', { count: 1 }))]);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0 && days.some((d) => d.exercises.length > 0) && !saving;

  function addDay() {
    setDays((current) => [...current, newDay(t('routine.dayDefaultName', { count: current.length + 1 }))]);
  }

  function removeDay(dayId: string) {
    setDays((current) => current.filter((d) => d.draftId !== dayId));
  }

  function renameDay(dayId: string, dayName: string) {
    setDays((current) => current.map((d) => (d.draftId === dayId ? { ...d, name: dayName } : d)));
  }

  function addExerciseTo(dayId: string) {
    requestExercisePick((exercise) => {
      const draftExercise: DraftExercise = {
        draftId: newId(),
        exerciseId: exercise.id,
        name: exerciseName(exercise, locale),
        trackingType: exercise.trackingType,
        ...defaultsFor(exercise.trackingType),
      };
      setDays((current) =>
        current.map((d) => (d.draftId === dayId ? { ...d, exercises: [...d.exercises, draftExercise] } : d)),
      );
    });
    router.push('/routine/pick-exercise');
  }

  function removeExercise(dayId: string, exerciseDraftId: string) {
    setDays((current) =>
      current.map((d) =>
        d.draftId === dayId ? { ...d, exercises: d.exercises.filter((e) => e.draftId !== exerciseDraftId) } : d,
      ),
    );
  }

  function updateExercise(dayId: string, exerciseDraftId: string, patch: Partial<DraftExercise>) {
    setDays((current) =>
      current.map((d) =>
        d.draftId === dayId
          ? {
              ...d,
              exercises: d.exercises.map((e) => (e.draftId === exerciseDraftId ? { ...e, ...patch } : e)),
            }
          : d,
      ),
    );
  }

  async function save() {
    if (!userDb || !canSave) return;
    setSaving(true);
    const draft: RoutineDraft = { name: name.trim(), days };
    try {
      await createRoutine(userDb, draft);
      router.replace('/routine/index');
    } catch (err) {
      console.error('[routine/new] save failed', err);
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="sectionTitle" style={styles.title}>
            {t('routine.newTitle')}
          </ThemedText>

          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={t('routine.namePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.nameInput,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          />

          {days.map((day) => (
            <DayEditor
              key={day.draftId}
              day={day}
              canRemove={days.length > 1}
              onRename={(dayName) => renameDay(day.draftId, dayName)}
              onRemoveDay={() => removeDay(day.draftId)}
              onAddExercise={() => addExerciseTo(day.draftId)}
              onRemoveExercise={(exId) => removeExercise(day.draftId, exId)}
              onUpdateExercise={(exId, patch) => updateExercise(day.draftId, exId, patch)}
            />
          ))}

          <PressableScale
            onPress={addDay}
            scaleTo={0.97}
            accessibilityRole="button"
            style={[styles.addDayButton, { borderColor: theme.border }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              {t('routine.addDay')}
            </ThemedText>
          </PressableScale>
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

function DayEditor({
  day,
  canRemove,
  onRename,
  onRemoveDay,
  onAddExercise,
  onRemoveExercise,
  onUpdateExercise,
}: {
  day: DraftDay;
  canRemove: boolean;
  onRename: (name: string) => void;
  onRemoveDay: () => void;
  onAddExercise: () => void;
  onRemoveExercise: (exerciseDraftId: string) => void;
  onUpdateExercise: (exerciseDraftId: string, patch: Partial<DraftExercise>) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <ThemedView type="backgroundElement" style={[styles.dayCard, { borderColor: theme.border }]}>
      <View style={styles.dayHeaderRow}>
        <TextInput
          value={day.name}
          onChangeText={onRename}
          style={[styles.dayNameInput, { color: theme.text }]}
        />
        {canRemove && (
          <PressableScale onPress={onRemoveDay} accessibilityRole="button" accessibilityLabel={t('routine.removeDay')}>
            <ThemedText themeColor="textSecondary">{t('routine.removeDay')}</ThemedText>
          </PressableScale>
        )}
      </View>

      {day.exercises.map((ex) => (
        <ExerciseEditorRow
          key={ex.draftId}
          exercise={ex}
          onChange={(patch) => onUpdateExercise(ex.draftId, patch)}
          onRemove={() => onRemoveExercise(ex.draftId)}
        />
      ))}

      <PressableScale
        onPress={onAddExercise}
        scaleTo={0.97}
        accessibilityRole="button"
        style={[styles.addExerciseButton, { borderColor: theme.border }]}
      >
        <ThemedText type="small" style={{ color: theme.accent }}>
          {t('routine.addExercise')}
        </ThemedText>
      </PressableScale>
    </ThemedView>
  );
}

function ExerciseEditorRow({
  exercise,
  onChange,
  onRemove,
}: {
  exercise: DraftExercise;
  onChange: (patch: Partial<DraftExercise>) => void;
  onRemove: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <ThemedView style={[styles.exerciseRow, { borderColor: theme.border }]}>
      <View style={styles.exerciseRowHeader}>
        <ThemedText type="smallBold" style={styles.exerciseName} numberOfLines={2}>
          {exercise.name}
        </ThemedText>
        <PressableScale onPress={onRemove} accessibilityRole="button" accessibilityLabel={t('routine.removeExercise')}>
          <ThemedText themeColor="textSecondary">✕</ThemedText>
        </PressableScale>
      </View>

      <View style={styles.exerciseFields}>
        <NumberField
          label={t('routine.sets')}
          value={exercise.targetSets}
          onChange={(v) => onChange({ targetSets: v })}
        />
        {exercise.trackingType === 'reps' ? (
          <>
            <NumberField
              label={t('routine.repsMin')}
              value={exercise.repRangeMin ?? 0}
              onChange={(v) => onChange({ repRangeMin: v })}
            />
            <NumberField
              label={t('routine.repsMax')}
              value={exercise.repRangeMax ?? 0}
              onChange={(v) => onChange({ repRangeMax: v })}
            />
          </>
        ) : exercise.trackingType === 'time' ? (
          <NumberField
            label={t('routine.durationSeconds')}
            value={exercise.targetDurationSeconds ?? 0}
            onChange={(v) => onChange({ targetDurationSeconds: v })}
          />
        ) : null}
        <NumberField
          label={t('routine.restSeconds')}
          value={exercise.restSeconds}
          onChange={(v) => onChange({ restSeconds: v })}
        />
      </View>
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
  dayCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayNameInput: { flex: 1, fontSize: 18, fontWeight: '600' },
  addExerciseButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  addDayButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  exerciseRow: {
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.two,
    gap: Spacing.two,
  },
  exerciseRowHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: Spacing.two },
  exerciseName: { flex: 1 },
  exerciseFields: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
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
