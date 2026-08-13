import { inArray } from 'drizzle-orm';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { NumberField } from '@/components/number-field';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  exerciseName,
  exercises,
  finishSession,
  lastSetForExercise,
  logSet,
  useCatalogDb,
  useRoutineDayExercises,
  useUserDb,
  useWorkoutSession,
  type ExerciseRow as ExerciseRowType,
  type PersonalRecordRow,
  type RoutineExerciseRow,
} from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';
import { cancelRestEnd, scheduleRestEnd } from '@/notifications/rest-timer';

/**
 * A JS `setInterval` freezes when the screen locks or the app backgrounds —
 * the classic mistake for a rest timer. `restEndsAt` is the absolute
 * timestamp rest ends at, so however long the interval was actually paused,
 * the next tick recomputes the true remaining time from `Date.now()` rather
 * than having drifted a counter down by 250ms at a time.
 *
 * `Date.now()` is read only inside the interval callback, never during
 * render (render must stay a pure function of props/state) and never as a
 * synchronous call in the effect body itself (React flags that as a
 * cascading-render risk) — only the deferred, periodic callback sets state.
 * That means the very first paint after a rest starts can lag up to 250ms
 * behind before this fires once; imperceptible against a multi-second rest
 * period, and simpler than fighting either rule for that one frame.
 * `restEndsAt != null` (a plain prop, not this hook's state) is what the
 * caller gates visibility on, so a stale leftover number here never shows
 * once rest has actually ended.
 */
function useRestCountdown(restEndsAt: number | null): number {
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (restEndsAt == null) return;
    const interval = setInterval(() => {
      setRemainingSeconds(Math.max(0, Math.round((restEndsAt - Date.now()) / 1000)));
    }, 250);
    return () => clearInterval(interval);
  }, [restEndsAt]);

  return remainingSeconds;
}

interface SetProgress {
  exerciseIndex: number;
  setIndex: number;
}

export default function WorkoutScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>();
  const session = useWorkoutSession(sessionId);
  const { exercises: routineExercises } = useRoutineDayExercises(session?.routineDayId ?? null);
  const catalogDb = useCatalogDb();
  const userDb = useUserDb();
  const theme = useTheme();
  const { t, locale } = useTranslation();

  const [catalogByExerciseId, setCatalogByExerciseId] = useState<Map<string, ExerciseRowType>>(new Map());
  const [progress, setProgress] = useState<SetProgress>({ exerciseIndex: 0, setIndex: 0 });
  const [weightKg, setWeightKg] = useState(0);
  const [reps, setReps] = useState(0);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [newRecords, setNewRecords] = useState<PersonalRecordRow[]>([]);
  const [finished, setFinished] = useState(false);
  const [totalVolumeKg, setTotalVolumeKg] = useState(0);
  const [logging, setLogging] = useState(false);
  const restNotificationIdRef = useRef<string | null>(null);

  const restSecondsRemaining = useRestCountdown(restEndsAt);
  const currentRoutineExercise: RoutineExerciseRow | undefined = routineExercises[progress.exerciseIndex];
  const currentExercise = currentRoutineExercise
    ? catalogByExerciseId.get(currentRoutineExercise.exerciseId)
    : undefined;

  useEffect(() => {
    const ids = Array.from(new Set(routineExercises.map((e) => e.exerciseId)));
    if (ids.length === 0) return;
    catalogDb
      .select()
      .from(exercises)
      .where(inArray(exercises.id, ids))
      .then((rows) => setCatalogByExerciseId(new Map(rows.map((r) => [r.id, r]))))
      .catch((err) => console.error('[workout] catalog hydrate failed', err));
  }, [catalogDb, routineExercises]);

  // Prefill weight/reps from the last time this exercise was logged, in a
  // *different* session — see lastSetForExercise. Runs each time the current
  // exercise or set changes, not just once, so set 2 prefills from set 1's
  // history the same way set 1 prefilled from last workout.
  useEffect(() => {
    if (!userDb || !currentRoutineExercise) return;
    let cancelled = false;
    lastSetForExercise(userDb, currentRoutineExercise.exerciseId, sessionId!)
      .then((last) => {
        if (cancelled || !last) return;
        if (last.weightKg != null) setWeightKg(last.weightKg);
        if (last.reps != null) setReps(last.reps);
        if (last.durationSeconds != null) setDurationSeconds(last.durationSeconds);
      })
      .catch((err) => console.error('[workout] last-set lookup failed', err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDb, currentRoutineExercise?.exerciseId, progress.exerciseIndex]);

  // Backstop for the rest timer: if the user never looks back at the app,
  // this still marks the end so the OS notification tray does the reminding
  // the frozen JS interval can't (see rest-timer.ts). Cancelled whenever
  // rest ends any other way (skipped, or superseded by a new rest window) so
  // a stale one doesn't fire minutes after the person already moved on.
  useEffect(() => {
    if (restEndsAt == null) return;
    let cancelled = false;
    const seconds = (restEndsAt - Date.now()) / 1000;
    scheduleRestEnd(seconds, currentExercise ? exerciseName(currentExercise, locale) : '', t('workout.restLabel'))
      .then((id) => {
        if (cancelled) {
          cancelRestEnd(id);
        } else {
          restNotificationIdRef.current = id;
        }
      })
      .catch((err) => console.error('[workout] rest notification failed', err));
    return () => {
      cancelled = true;
      if (restNotificationIdRef.current) {
        cancelRestEnd(restNotificationIdRef.current);
        restNotificationIdRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restEndsAt]);

  const isLastSetOfExercise = currentRoutineExercise
    ? progress.setIndex >= currentRoutineExercise.targetSets - 1
    : false;
  const isLastExercise = progress.exerciseIndex >= routineExercises.length - 1;
  const isTimeBased = currentRoutineExercise?.targetDurationSeconds != null;

  async function logCurrentSet() {
    if (!userDb || !sessionId || !currentRoutineExercise || logging) return;
    setLogging(true);
    try {
      const achieved = await logSet(userDb, {
        sessionId,
        exerciseId: currentRoutineExercise.exerciseId,
        setIndex: progress.setIndex,
        weightKg: isTimeBased ? null : weightKg,
        reps: isTimeBased ? null : reps,
        durationSeconds: isTimeBased ? durationSeconds : null,
        distanceMeters: null,
        isWarmup: false,
      });
      if (achieved.length > 0) setNewRecords((current) => [...current, ...achieved]);

      if (currentRoutineExercise.restSeconds > 0 && !(isLastSetOfExercise && isLastExercise)) {
        setRestEndsAt(Date.now() + currentRoutineExercise.restSeconds * 1000);
      }

      if (!isLastSetOfExercise) {
        setProgress((p) => ({ ...p, setIndex: p.setIndex + 1 }));
      } else if (!isLastExercise) {
        setProgress({ exerciseIndex: progress.exerciseIndex + 1, setIndex: 0 });
      } else {
        await finish();
      }
    } catch (err) {
      console.error('[workout] log set failed', err);
    } finally {
      setLogging(false);
    }
  }

  async function finish() {
    if (!userDb || !sessionId) return;
    const { totalVolumeKg: volume } = await finishSession(userDb, sessionId);
    setTotalVolumeKg(volume);
    setFinished(true);
  }

  function confirmFinishEarly() {
    Alert.alert(t('workout.finishConfirmTitle'), t('workout.finishConfirmBody'), [
      { text: t('workout.cancel'), style: 'cancel' },
      {
        text: t('workout.confirm'),
        style: 'destructive',
        onPress: () => finish().catch((err) => console.error('[workout] finish early failed', err)),
      },
    ]);
  }

  const setsSummary = useMemo(
    () => routineExercises.map((e) => e.targetSets).reduce((a, b) => a + b, 0),
    [routineExercises],
  );

  if (finished) {
    return (
      <WorkoutSummary
        totalVolumeKg={totalVolumeKg}
        newRecordsCount={newRecords.length}
        onDone={() => router.replace('/(tabs)')}
      />
    );
  }

  if (!session || routineExercises.length === 0 || !currentExercise || !currentRoutineExercise) {
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
          <View style={styles.topRow}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('routine.sets')} {setsSummary}
            </ThemedText>
            <PressableScale onPress={confirmFinishEarly} accessibilityRole="button">
              <ThemedText type="small" style={{ color: theme.accent }}>
                {t('workout.finish')}
              </ThemedText>
            </PressableScale>
          </View>

          <ThemedText type="sectionTitle" style={styles.exerciseTitle}>
            {exerciseName(currentExercise, locale)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {t('workout.setNumber', { count: progress.setIndex + 1 })} / {currentRoutineExercise.targetSets}
          </ThemedText>

          {restEndsAt != null && restSecondsRemaining > 0 ? (
            <ThemedView type="backgroundElement" style={[styles.restCard, { borderColor: theme.border }]}>
              <ThemedText type="title" style={{ color: theme.accent }}>
                {restSecondsRemaining}s
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {t('workout.restLabel')}
              </ThemedText>
              <PressableScale
                onPress={() => setRestEndsAt(null)}
                scaleTo={0.96}
                accessibilityRole="button"
                style={[styles.skipButton, { borderColor: theme.border }]}
              >
                <ThemedText type="small">{t('workout.skipRest')}</ThemedText>
              </PressableScale>
            </ThemedView>
          ) : (
            <ThemedView type="backgroundElement" style={[styles.entryCard, { borderColor: theme.border }]}>
              {isTimeBased ? (
                <NumberField label={t('routine.durationSeconds')} value={durationSeconds} onChange={setDurationSeconds} />
              ) : (
                <View style={styles.entryFields}>
                  <NumberField label={t('workout.weightKg')} value={weightKg} onChange={setWeightKg} allowDecimal />
                  <NumberField label={t('workout.reps')} value={reps} onChange={setReps} />
                </View>
              )}

              <PressableScale
                onPress={logCurrentSet}
                disabled={logging}
                scaleTo={0.97}
                accessibilityRole="button"
                style={[styles.logButton, { backgroundColor: theme.accent }]}
              >
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  {t('routine.logSet')}
                </ThemedText>
              </PressableScale>
            </ThemedView>
          )}

          {newRecords.length > 0 && (
            <ThemedText type="small" style={[styles.prBanner, { color: theme.accent }]}>
              {t('workout.newPersonalRecord')}
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function WorkoutSummary({
  totalVolumeKg,
  newRecordsCount,
  onDone,
}: {
  totalVolumeKg: number;
  newRecordsCount: number;
  onDone: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={[styles.safeArea, styles.summaryContainer]} edges={['top', 'bottom']}>
        <ThemedText type="title">{t('workout.summaryTitle')}</ThemedText>
        <View style={styles.summaryStat}>
          <ThemedText type="small" themeColor="textSecondary">
            {t('workout.summaryVolume')}
          </ThemedText>
          <ThemedText type="subtitle">{Math.round(totalVolumeKg)} kg</ThemedText>
        </View>
        {newRecordsCount > 0 && (
          <View style={styles.summaryStat}>
            <ThemedText type="small" themeColor="textSecondary">
              {t('workout.summaryNewRecords')}
            </ThemedText>
            <ThemedText type="subtitle" style={{ color: theme.accent }}>
              {newRecordsCount}
            </ThemedText>
          </View>
        )}
        <PressableScale
          onPress={onDone}
          scaleTo={0.97}
          accessibilityRole="button"
          style={[styles.logButton, { backgroundColor: theme.accent }]}
        >
          <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
            {t('workout.summaryDone')}
          </ThemedText>
        </PressableScale>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scrollContent: { padding: Spacing.three, gap: Spacing.two },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  exerciseTitle: { marginTop: Spacing.three },
  restCard: {
    alignItems: 'center',
    gap: Spacing.two,
    marginTop: Spacing.four,
    padding: Spacing.five,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  skipButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  entryCard: {
    marginTop: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.three,
  },
  entryFields: { flexDirection: 'row', gap: Spacing.three },
  logButton: { alignItems: 'center', paddingVertical: Spacing.two + 2, borderRadius: Radius.pill },
  prBanner: { textAlign: 'center', marginTop: Spacing.three },
  summaryContainer: { alignItems: 'center', justifyContent: 'center', gap: Spacing.four, padding: Spacing.four },
  summaryStat: { alignItems: 'center', gap: Spacing.half },
});
