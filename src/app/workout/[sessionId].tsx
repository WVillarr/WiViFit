import { inArray } from 'drizzle-orm';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { NumberField } from '@/components/number-field';
import { PressableScale } from '@/components/pressable-scale';
import { ProgressRing } from '@/components/progress-ring';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
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

import { requestExercisePick } from '@/routine-picker-bridge';

/** A module-level helper, not inline in the component body, so React
 *  Compiler's purity check doesn't need to reason about a direct Date.now()
 *  read inside render-reachable code — the same reason useRestCountdown's
 *  own Date.now() call below only ever happens inside a setInterval callback. */
function computeRestEndsAt(restSeconds: number): number {
  return Date.now() + restSeconds * 1000;
}

/** A freeform session has no routine_exercises row to read a rest period
 *  from — the guide doesn't specify one for this mode, so this is a plain,
 *  reasonable default rather than a derived value. */
const FREEFORM_REST_SECONDS = 90;

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
 *
 * The first tick is up to 250ms away, and a tick is stamped with the window
 * it measured so the gap can't be filled with the *previous* rest's leftover
 * number: until this window's own tick lands, the full `totalSeconds` is the
 * honest answer. Without that stamp the ring opens a fresh rest at the old
 * rest's fraction (a 90s window skipped with 45s left would paint the next
 * one half-drained, then sweep back up to full), and a window that ran to
 * zero would leave 0 behind — dropping below the caller's `> 0` visibility
 * gate and flashing the entry card for a beat before rest appears.
 *
 * Stamp and value are two parallel primitives rather than one `{ endsAt,
 * seconds }` object, matching the same trade-off `restEndsAt` /
 * `restExerciseLabel` make in the component below; both land in one batch
 * from the same callback, so render never sees a half-updated pair.
 */
function useRestCountdown(restEndsAt: number | null, totalSeconds: number): number {
  const [tickEndsAt, setTickEndsAt] = useState<number | null>(null);
  const [tickSeconds, setTickSeconds] = useState(0);

  useEffect(() => {
    if (restEndsAt == null) return;
    const interval = setInterval(() => {
      setTickSeconds(Math.max(0, Math.round((restEndsAt - Date.now()) / 1000)));
      setTickEndsAt(restEndsAt);
    }, 250);
    return () => clearInterval(interval);
  }, [restEndsAt]);

  return tickEndsAt === restEndsAt ? tickSeconds : totalSeconds;
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
  const [distanceMeters, setDistanceMeters] = useState(0);
  // Two parallel primitives rather than one `{ endsAt, exerciseLabel }`
  // object — the label still has to be captured in the same synchronous
  // batch as endsAt (see logCurrentSet and the notification effect below for
  // why), but React Compiler flags constructing a new object from an impure
  // Date.now() read as a memoization hazard; two primitive setState calls
  // sidestep that without losing the fix.
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  // The rest window's original length, captured alongside restEndsAt — the
  // ring needs a denominator to turn "seconds left" into a 0-1 fraction, and
  // restEndsAt alone only gives an absolute end time.
  const [totalRestSeconds, setTotalRestSeconds] = useState(0);
  const [restExerciseLabel, setRestExerciseLabel] = useState('');
  const [newRecords, setNewRecords] = useState<PersonalRecordRow[]>([]);
  const [finished, setFinished] = useState(false);
  const [totalVolumeKg, setTotalVolumeKg] = useState(0);
  const [logging, setLogging] = useState(false);
  const restNotificationIdRef = useRef<string | null>(null);

  // No routineDayId — the user started this from Home's "start a workout"
  // rather than a routine day, so there's no predetermined exercise list to
  // step through. See freeformExercise below: the exercise (and how many
  // sets) is chosen as the workout happens, not planned ahead of time.
  const isFreeform = session != null && session.routineDayId == null;
  const [freeformExercise, setFreeformExercise] = useState<ExerciseRowType | null>(null);
  const [freeformSetIndex, setFreeformSetIndex] = useState(0);
  const [freeformLoggedCount, setFreeformLoggedCount] = useState(0);

  const restSecondsRemaining = useRestCountdown(restEndsAt, totalRestSeconds);
  const currentRoutineExercise: RoutineExerciseRow | undefined = routineExercises[progress.exerciseIndex];
  const currentExercise = currentRoutineExercise
    ? catalogByExerciseId.get(currentRoutineExercise.exerciseId)
    : undefined;
  const activeExercise = isFreeform ? freeformExercise : currentExercise;

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
  // *different* session — see lastSetForExercise. Runs each time the active
  // exercise or set changes, not just once, so set 2 prefills from set 1's
  // history the same way set 1 prefilled from last workout. Keyed on
  // activeExercise.id so this works identically whether it came from a
  // routine day or was picked ad-hoc in a freeform session.
  useEffect(() => {
    if (!userDb || !activeExercise) return;
    let cancelled = false;
    lastSetForExercise(userDb, activeExercise.id, sessionId!)
      .then((last) => {
        if (cancelled || !last) return;
        if (last.weightKg != null) setWeightKg(last.weightKg);
        if (last.reps != null) setReps(last.reps);
        if (last.durationSeconds != null) setDurationSeconds(last.durationSeconds);
        if (last.distanceMeters != null) setDistanceMeters(last.distanceMeters);
      })
      .catch((err) => console.error('[workout] last-set lookup failed', err));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDb, activeExercise?.id, progress.exerciseIndex]);

  // Backstop for the rest timer: if the user never looks back at the app,
  // this still marks the end so the OS notification tray does the reminding
  // the frozen JS interval can't (see rest-timer.ts). Cancelled whenever
  // rest ends any other way (skipped, or superseded by a new rest window) so
  // a stale one doesn't fire minutes after the person already moved on.
  //
  // Reads `restExerciseLabel` rather than `currentExercise` on purpose:
  // `setRestEndsAt`/`setRestExerciseLabel` and the `setProgress` that
  // advances to the next exercise all run synchronously inside the same
  // `logCurrentSet` call and land in the same React batch, so by the time
  // this effect re-runs (on `restEndsAt` changing), `currentExercise`
  // already points at the *next* exercise — the notification would announce
  // the wrong one. Capturing the label into its own state at the moment rest
  // starts (see logCurrentSet) sidesteps the render-order race entirely.
  useEffect(() => {
    if (restEndsAt == null) return;
    let cancelled = false;
    const seconds = (restEndsAt - Date.now()) / 1000;
    scheduleRestEnd(seconds, restExerciseLabel, t('workout.restLabel'))
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
    // t/restExerciseLabel aren't deps: t's identity churns every render
    // without its content changing mid-session, and restExerciseLabel is
    // always set in the same batch as restEndsAt (see logCurrentSet) so it's
    // never stale when this reads it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restEndsAt]);

  const isLastSetOfExercise = currentRoutineExercise
    ? progress.setIndex >= currentRoutineExercise.targetSets - 1
    : false;
  const isLastExercise = progress.exerciseIndex >= routineExercises.length - 1;
  // The catalog's own trackingType, not which routine_exercises field happens
  // to be non-null — that's the authoritative source (see
  // exercises.trackingType in catalog-schema.ts) and it's what the routine
  // creator (routine/new.tsx) already branches on for the same reason.
  const activeTrackingType = activeExercise?.trackingType ?? 'reps';

  function pickFreeformExercise() {
    requestExercisePick((exercise) => {
      setFreeformExercise(exercise);
      setFreeformSetIndex(0);
      setWeightKg(0);
      setReps(0);
      setDurationSeconds(0);
      setDistanceMeters(0);
    });
    router.push('/routine/pick-exercise');
  }

  async function logCurrentSet() {
    if (!userDb || !sessionId || !activeExercise || logging) return;
    if (!isFreeform && !currentRoutineExercise) return;
    setLogging(true);
    try {
      const setIndex = isFreeform ? freeformSetIndex : progress.setIndex;
      const achieved = await logSet(userDb, {
        sessionId,
        exerciseId: activeExercise.id,
        setIndex,
        weightKg: activeTrackingType === 'reps' ? weightKg : null,
        reps: activeTrackingType === 'reps' ? reps : null,
        durationSeconds: activeTrackingType === 'reps' ? null : durationSeconds,
        distanceMeters: activeTrackingType === 'distance' ? distanceMeters : null,
        isWarmup: false,
      });
      if (achieved.length > 0) setNewRecords((current) => [...current, ...achieved]);

      if (isFreeform) {
        // Both set now, before setFreeformSetIndex (below) can advance —
        // same ordering reason as the routine branch's comment.
        setRestExerciseLabel(exerciseName(activeExercise, locale));
        setRestEndsAt(computeRestEndsAt(FREEFORM_REST_SECONDS));
        setTotalRestSeconds(FREEFORM_REST_SECONDS);
        setFreeformSetIndex((i) => i + 1);
        setFreeformLoggedCount((c) => c + 1);
        return;
      }

      if (currentRoutineExercise!.restSeconds > 0 && !(isLastSetOfExercise && isLastExercise)) {
        // Both set now, before setProgress (below) can advance
        // currentExercise to the next one in the same batch.
        setRestExerciseLabel(currentExercise ? exerciseName(currentExercise, locale) : '');
        setRestEndsAt(computeRestEndsAt(currentRoutineExercise!.restSeconds));
        setTotalRestSeconds(currentRoutineExercise!.restSeconds);
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

  if (!session) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']} />
      </ThemedView>
    );
  }

  // A freeform session has no routine day to still be loading exercises
  // for — activeExercise being null there just means "hasn't picked one
  // yet" (see the prompt card below), not "still loading".
  if (!isFreeform && (routineExercises.length === 0 || !currentExercise || !currentRoutineExercise)) {
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
              {isFreeform
                ? t('routine.freeformSetsLogged', { count: freeformLoggedCount })
                : `${t('routine.sets')} ${setsSummary}`}
            </ThemedText>
            <PressableScale onPress={confirmFinishEarly} accessibilityRole="button">
              <ThemedText type="small" style={{ color: theme.accent }}>
                {t('workout.finish')}
              </ThemedText>
            </PressableScale>
          </View>

          {activeExercise ? (
            <>
              {!isFreeform && (
                <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.exerciseEyebrow}>
                  {t('workout.exerciseNumber', {
                    count: progress.exerciseIndex + 1,
                    total: routineExercises.length,
                  }).toUpperCase()}
                </ThemedText>
              )}
              <ThemedText
                type="subtitle"
                numberOfLines={2}
                style={[styles.exerciseTitle, !isFreeform && styles.exerciseTitleWithEyebrow]}
              >
                {exerciseName(activeExercise, locale)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {isFreeform
                  ? t('workout.setNumber', { count: freeformSetIndex + 1 })
                  : `${t('workout.setNumber', { count: progress.setIndex + 1 })} / ${currentRoutineExercise!.targetSets}`}
              </ThemedText>

              {restEndsAt != null && restSecondsRemaining > 0 ? (
                <ThemedView type="backgroundElement" style={[styles.restCard, { borderColor: theme.border }]}>
                  <ProgressRing
                    size={168}
                    strokeWidth={10}
                    progress={totalRestSeconds > 0 ? restSecondsRemaining / totalRestSeconds : 0}
                    color={theme.accent}
                    trackColor={theme.border}
                  >
                    <ThemedText type="title" style={{ color: theme.accent }}>
                      {restSecondsRemaining}
                    </ThemedText>
                  </ProgressRing>
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
                  {activeTrackingType === 'reps' ? (
                    <View style={styles.entryFields}>
                      <NumberField label={t('workout.weightKg')} value={weightKg} onChange={setWeightKg} allowDecimal />
                      <NumberField label={t('workout.reps')} value={reps} onChange={setReps} />
                    </View>
                  ) : activeTrackingType === 'time' ? (
                    <NumberField label={t('routine.durationSeconds')} value={durationSeconds} onChange={setDurationSeconds} />
                  ) : (
                    <View style={styles.entryFields}>
                      <NumberField label={t('routine.durationSeconds')} value={durationSeconds} onChange={setDurationSeconds} />
                      <NumberField label={t('workout.distanceMeters')} value={distanceMeters} onChange={setDistanceMeters} />
                    </View>
                  )}

                  <PressableScale
                    onPress={logCurrentSet}
                    disabled={logging}
                    scaleTo={0.97}
                    accessibilityRole="button"
                    style={[styles.logButton, { backgroundColor: theme.accent }]}
                  >
                    <View style={styles.logButtonContent}>
                      <Icon name="check" size={16} color={theme.onAccent} strokeWidth={2} />
                      <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                        {t('workout.logSet')}
                      </ThemedText>
                    </View>
                  </PressableScale>

                  {isFreeform && (
                    <PressableScale
                      onPress={() => setFreeformExercise(null)}
                      accessibilityRole="button"
                      style={styles.changeExerciseButton}
                    >
                      <ThemedText type="small" themeColor="textSecondary">
                        {t('routine.freeformChangeExercise')}
                      </ThemedText>
                    </PressableScale>
                  )}
                </ThemedView>
              )}
            </>
          ) : (
            <ThemedView type="backgroundElement" style={[styles.entryCard, { borderColor: theme.border }]}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.freeformHint}>
                {t('routine.freeformHint')}
              </ThemedText>
              <PressableScale
                onPress={pickFreeformExercise}
                scaleTo={0.97}
                accessibilityRole="button"
                style={[styles.logButton, { backgroundColor: theme.accent }]}
              >
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  {t('routine.freeformPickExercise')}
                </ThemedText>
              </PressableScale>
            </ThemedView>
          )}

          {newRecords.length > 0 && (
            <ThemedView style={[styles.prBanner, { backgroundColor: theme.accentSoft }]}>
              <Icon name="flame" size={16} color={theme.accent} />
              <ThemedText type="smallBold" style={{ color: theme.accent }}>
                {t('workout.newPersonalRecord')}
              </ThemedText>
            </ThemedView>
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
        <View style={styles.summaryStatsRow}>
          <View style={[styles.summaryStatCard, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Icon name="dumbbell" size={20} color={theme.accent} strokeWidth={1.6} />
            <ThemedText type="subtitle">{Math.round(totalVolumeKg)} kg</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('workout.summaryVolume')}
            </ThemedText>
          </View>
          {newRecordsCount > 0 && (
            <View style={[styles.summaryStatCard, { backgroundColor: theme.accentSoft, borderColor: theme.accentSoft }]}>
              <Icon name="flame" size={20} color={theme.accent} />
              <ThemedText type="subtitle" style={{ color: theme.accent }}>
                {newRecordsCount}
              </ThemedText>
              <ThemedText type="small" style={{ color: theme.accent }}>
                {t('workout.summaryNewRecords')}
              </ThemedText>
            </View>
          )}
        </View>
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
  exerciseEyebrow: { marginTop: Spacing.four },
  exerciseTitle: { marginTop: Spacing.three },
  exerciseTitleWithEyebrow: { marginTop: Spacing.half },
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
  logButtonContent: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  changeExerciseButton: { alignItems: 'center', paddingVertical: Spacing.one },
  freeformHint: { textAlign: 'center', marginBottom: Spacing.one },
  prBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.one,
    marginTop: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
  },
  summaryContainer: { alignItems: 'center', justifyContent: 'center', gap: Spacing.four, padding: Spacing.four },
  summaryStatsRow: { flexDirection: 'row', gap: Spacing.three },
  summaryStatCard: {
    alignItems: 'center',
    gap: Spacing.half,
    minWidth: 130,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    ...CardShadow,
  },
});
