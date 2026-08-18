import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { Icon } from '@/components/icon';
import { NumberField } from '@/components/number-field';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { exerciseName, newId } from '@/db';
import type { DraftDay, DraftExercise } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

import { requestExercisePick } from '@/app/routine/_picker-bridge';

/**
 * Defaults chosen by trackingType, not a single "3x10" for everything — a
 * plank isn't a rep range and shouldn't be presented as one. See
 * exercises.trackingType in catalog-schema.ts (Fase 1's enrichment).
 */
export function defaultsFor(trackingType: DraftExercise['trackingType']) {
  if (trackingType === 'time') {
    return {
      targetSets: 3,
      repRangeMin: null,
      repRangeMax: null,
      targetDurationSeconds: 30,
      targetDistanceMeters: null,
      restSeconds: 60,
    };
  }
  if (trackingType === 'distance') {
    // A round, easy-to-adjust starting point — 1km at a moderate pace.
    return {
      targetSets: 1,
      repRangeMin: null,
      repRangeMax: null,
      targetDurationSeconds: 300,
      targetDistanceMeters: 1000,
      restSeconds: 90,
    };
  }
  return {
    targetSets: 3,
    repRangeMin: 8,
    repRangeMax: 12,
    targetDurationSeconds: null,
    targetDistanceMeters: null,
    restSeconds: 90,
  };
}

function newDay(name: string): DraftDay {
  return { draftId: newId(), name, exercises: [] };
}

/**
 * All the in-memory mutation state for building or editing a routine draft —
 * shared by routine/new.tsx (starts empty) and routine/[id]/edit.tsx (starts
 * hydrated from the existing routine). Nothing here touches the database;
 * the caller decides whether to createRoutine or updateRoutine with the
 * resulting draft.
 */
export function useRoutineDraft(initialName: string, initialDays: DraftDay[]) {
  const { t, locale } = useTranslation();
  const [name, setName] = useState(initialName);
  const [days, setDays] = useState<DraftDay[]>(
    initialDays.length > 0 ? initialDays : [newDay(t('routine.dayDefaultName', { count: 1 }))],
  );

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

  return { name, setName, days, addDay, removeDay, renameDay, addExerciseTo, removeExercise, updateExercise };
}

export function RoutineDaysEditor({
  days,
  onRename,
  onRemoveDay,
  onAddExercise,
  onRemoveExercise,
  onUpdateExercise,
  onAddDay,
}: {
  days: DraftDay[];
  onRename: (dayId: string, name: string) => void;
  onRemoveDay: (dayId: string) => void;
  onAddExercise: (dayId: string) => void;
  onRemoveExercise: (dayId: string, exerciseDraftId: string) => void;
  onUpdateExercise: (dayId: string, exerciseDraftId: string, patch: Partial<DraftExercise>) => void;
  onAddDay: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <>
      {days.map((day) => (
        <DayEditor
          key={day.draftId}
          day={day}
          canRemove={days.length > 1}
          onRename={(dayName) => onRename(day.draftId, dayName)}
          onRemoveDay={() => onRemoveDay(day.draftId)}
          onAddExercise={() => onAddExercise(day.draftId)}
          onRemoveExercise={(exId) => onRemoveExercise(day.draftId, exId)}
          onUpdateExercise={(exId, patch) => onUpdateExercise(day.draftId, exId, patch)}
        />
      ))}

      <PressableScale
        onPress={onAddDay}
        scaleTo={0.97}
        accessibilityRole="button"
        style={[styles.addDayButton, { borderColor: theme.border }]}
      >
        <Icon name="plus" size={15} color={theme.accent} strokeWidth={2} />
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {t('routine.addDay')}
        </ThemedText>
      </PressableScale>
    </>
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
            <Icon name="trash" size={16} color={theme.textSecondary} />
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
        <Icon name="plus" size={14} color={theme.accent} strokeWidth={2} />
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
          <Icon name="close" size={16} color={theme.textSecondary} />
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
        ) : (
          // 'distance' — cronómetro + distancia, per the guide's tracking table.
          <>
            <NumberField
              label={t('routine.durationSeconds')}
              value={exercise.targetDurationSeconds ?? 0}
              onChange={(v) => onChange({ targetDurationSeconds: v })}
            />
            <NumberField
              label={t('routine.targetDistanceMeters')}
              value={exercise.targetDistanceMeters ?? 0}
              onChange={(v) => onChange({ targetDistanceMeters: v })}
            />
          </>
        )}
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
  dayCard: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  dayHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dayNameInput: { flex: 1, fontSize: 18, fontWeight: '600' },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  addDayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.one,
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
});
