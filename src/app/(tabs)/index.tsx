import { sql, eq } from 'drizzle-orm';
import { Image } from 'expo-image';
import { router, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { GradientSurface } from '@/components/gradient-surface';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  exerciseName,
  exercises,
  ExerciseListItem,
  startSession,
  useCatalogDb,
  useFavorites,
  useRecentlyViewed,
  useUserDb,
} from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';
import { mediaProvider } from '@/media';

// A handful of common groups, enough for quick access without crowding the screen.
const QUICK_MUSCLES = ['pectorals', 'abs', 'glutes', 'quads', 'upper_back', 'delts'] as const;

const LIST_COLUMNS = {
  id: exercises.id,
  name: exercises.name,
  nameEs: exercises.nameEs,
  target: exercises.target,
};
const SUGGESTED_COUNT = 8;

function useGreeting() {
  const { t } = useTranslation();
  const hour = new Date().getHours();
  if (hour < 12) return t('home.greetingMorning');
  if (hour < 19) return t('home.greetingAfternoon');
  return t('home.greetingEvening');
}

export default function HomeScreen() {
  const db = useCatalogDb();
  const theme = useTheme();
  const { t } = useTranslation();
  const { items: favoriteItems } = useFavorites();
  const recentItems = useRecentlyViewed();
  const userDb = useUserDb();

  const greeting = useGreeting();
  const [motivationIndex, setMotivationIndex] = useState(1);
  const [startingFreeform, setStartingFreeform] = useState(false);

  const [activeMuscle, setActiveMuscle] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<ExerciseListItem[]>([]);
  const [suggestedError, setSuggestedError] = useState(false);

  async function fetchSuggested(muscle: string | null) {
    try {
      const rows = await db
        .select(LIST_COLUMNS)
        .from(exercises)
        .where(muscle ? eq(exercises.target, muscle) : undefined)
        .orderBy(sql`RANDOM()`)
        .limit(SUGGESTED_COUNT);
      setSuggested(rows);
      setSuggestedError(false);
    } catch (err) {
      console.error('[home] query failed', err);
      setSuggestedError(true);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const rows = await db
          .select(LIST_COLUMNS)
          .from(exercises)
          .orderBy(sql`RANDOM()`)
          .limit(SUGGESTED_COUNT);
        if (cancelled) return;
        setSuggested(rows);
        setMotivationIndex(1 + Math.floor(Math.random() * 4));
        setSuggestedError(false);
      } catch (err) {
        if (!cancelled) {
          console.error('[home] query failed', err);
          setSuggestedError(true);
        }
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [db]);

  function onChipPress(muscle: string) {
    const next = activeMuscle === muscle ? null : muscle;
    setActiveMuscle(next);
    fetchSuggested(next);
  }

  function onShuffle() {
    fetchSuggested(activeMuscle);
  }

  function onTrainNow() {
    if (suggested.length === 0) return;
    const pick = suggested[Math.floor(Math.random() * suggested.length)];
    router.push(`/exercise/${pick.id}`);
  }

  /** No routine day — the workout screen picks exercises ad-hoc as the
   *  session happens (see isFreeform in workout/[sessionId].tsx). */
  async function onStartFreeform() {
    if (!userDb || startingFreeform) return;
    setStartingFreeform(true);
    try {
      const sessionId = await startSession(userDb, null);
      // `as Href`: generated-types staleness, not a real route error — see
      // the same cast on the routines banner below.
      router.push(`/workout/${sessionId}` as Href);
    } catch (err) {
      console.error('[home] start freeform session failed', err);
    } finally {
      setStartingFreeform(false);
    }
  }

  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1.02, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [pulse]);
  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={styles.header}>
          <ThemedText type="eyebrow" themeColor="textSecondary">
            {greeting.toUpperCase()}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.motivation}>
            {t(`home.motivation${motivationIndex}`)}
          </ThemedText>
        </ThemedView>

        <Animated.View style={pulseStyle}>
          <PressableScale
            onPress={onTrainNow}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={`${t('home.ctaLabel')}. ${t('home.ctaHint')}`}
            style={styles.ctaWrap}
          >
            <GradientSurface style={styles.ctaCard}>
              <ThemedView style={styles.ctaTextGroup}>
                <ThemedText type="subtitle" style={{ color: theme.onAccent }}>
                  {t('home.ctaLabel')}
                </ThemedText>
                <ThemedText style={[styles.ctaSubtitle, { color: theme.onAccent }]}>
                  {t('home.ctaHint')}
                </ThemedText>
              </ThemedView>
              <ThemedView style={[styles.ctaBadge, { backgroundColor: theme.onAccentWash }]}>
                <ThemedText style={[styles.ctaArrow, { color: theme.onAccent }]}>→</ThemedText>
              </ThemedView>
            </GradientSurface>
          </PressableScale>
        </Animated.View>

        <ThemedView style={styles.quickStartRow}>
          <PressableScale
            // `as Href`: generated-types staleness, not a real route error —
            // see the same cast in routine/index.tsx.
            onPress={() => router.push('/routine/index' as Href)}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t('routine.listTitle')}
            style={[styles.routinesBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          >
            <ThemedText type="smallBold">{t('routine.listTitle')}</ThemedText>
            <ThemedText type="small" style={{ color: theme.accent }}>
              ›
            </ThemedText>
          </PressableScale>

          <PressableScale
            onPress={onStartFreeform}
            disabled={startingFreeform}
            scaleTo={0.98}
            accessibilityRole="button"
            accessibilityLabel={t('routine.freeformStart')}
            style={[styles.routinesBanner, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
          >
            <ThemedText type="smallBold">{t('routine.freeformStart')}</ThemedText>
            <ThemedText type="small" style={{ color: theme.accent }}>
              ›
            </ThemedText>
          </PressableScale>
        </ThemedView>

        {favoriteItems.length > 0 && (
          <ExerciseShelf title={t('home.favoritesTitle')} items={favoriteItems} />
        )}
        {recentItems.length > 0 && (
          <ExerciseShelf title={t('home.recentTitle')} items={recentItems} />
        )}

        <ThemedText type="sectionTitle" style={styles.sectionLabel}>
          {t('home.quickAccessTitle')}
        </ThemedText>
        {/* Six fixed pills and eight cards below — both rows render in full
            either way, so a ScrollView drops the virtualization bookkeeping
            without changing what's on screen. */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
        >
          {QUICK_MUSCLES.map((muscle) => (
            <MuscleChip
              key={muscle}
              muscle={muscle}
              selected={activeMuscle === muscle}
              onPress={onChipPress}
            />
          ))}
        </ScrollView>

        <ThemedView style={styles.sectionHeaderRow}>
          <ThemedText type="sectionTitle">
            {activeMuscle ? t(`muscles.${activeMuscle}`) : t('home.suggestedTitle')}
          </ThemedText>
          <PressableScale
            onPress={onShuffle}
            scaleTo={0.92}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={t('home.shuffle')}
          >
            <ShuffleLabel />
          </PressableScale>
        </ThemedView>

        {suggestedError ? (
          <ErrorState onRetry={() => fetchSuggested(activeMuscle)} />
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.suggestedRow}
            contentContainerStyle={styles.suggestedRowContent}
          >
            {suggested.map((item, index) => (
              <SuggestedCard key={item.id} item={item} index={index} />
            ))}
          </ScrollView>
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function ShuffleLabel() {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <ThemedText type="smallBold" style={{ color: theme.accent }}>
      {t('home.shuffle')} ⟳
    </ThemedText>
  );
}

function MuscleChip({
  muscle,
  selected,
  onPress,
}: {
  muscle: string;
  selected: boolean;
  onPress: (muscle: string) => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <PressableScale
      onPress={() => onPress(muscle)}
      scaleTo={0.94}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.border,
        },
      ]}
    >
      <ThemedText
        type={selected ? 'smallBold' : 'small'}
        numberOfLines={1}
        style={{ color: selected ? theme.onAccent : theme.text }}
      >
        {t(`muscles.${muscle}`)}
      </ThemedText>
    </PressableScale>
  );
}

/** A titled horizontal row of cards — the same shape favorites, recently
 *  viewed, and the suggested-for-today row all need. */
function ExerciseShelf({ title, items }: { title: string; items: ExerciseListItem[] }) {
  return (
    <>
      <ThemedText type="sectionTitle" style={styles.sectionLabel}>
        {title}
      </ThemedText>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.suggestedRow}
        contentContainerStyle={styles.suggestedRowContent}
      >
        {items.map((item, index) => (
          <SuggestedCard key={item.id} item={item} index={index} />
        ))}
      </ScrollView>
    </>
  );
}

function SuggestedCard({ item, index }: { item: ExerciseListItem; index: number }) {
  const { t, locale } = useTranslation();
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInRight.delay(index * 60).duration(320)}>
      <PressableScale
        onPress={() => router.push(`/exercise/${item.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${exerciseName(item, locale)}, ${t(`muscles.${item.target}`)}`}
        style={[styles.suggestedCard, { backgroundColor: theme.backgroundElement }]}
      >
        <Image
          source={mediaProvider.getThumbnail(item.id)}
          style={[styles.suggestedThumbnail, { backgroundColor: theme.backgroundSelected }]}
          contentFit="cover"
          // Shuffling swaps the data under the recycled row — see ExerciseRow.
          recyclingKey={item.id}
          transition={150}
          cachePolicy="memory-disk"
        />
        <ThemedView style={styles.suggestedMeta}>
          <ThemedText type="smallBold" numberOfLines={2} style={styles.suggestedName}>
            {exerciseName(item, locale)}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {t(`muscles.${item.target}`)}
          </ThemedText>
        </ThemedView>
      </PressableScale>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  header: {
    paddingLeft: Spacing.three,
    // Keeps a long motivation line off the right edge instead of running into it.
    paddingRight: Spacing.five,
    paddingTop: Platform.select({ web: Spacing.six, default: Spacing.three }),
    gap: Spacing.one,
  },
  motivation: { marginTop: Spacing.half },
  ctaWrap: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.four,
    borderRadius: Radius.xl,
    ...CardShadow,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radius.xl,
    overflow: 'hidden',
  },
  ctaTextGroup: { backgroundColor: 'transparent', flexShrink: 1 },
  ctaSubtitle: { opacity: 0.85, marginTop: Spacing.half },
  ctaBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaArrow: { fontSize: 22, lineHeight: 26 },
  quickStartRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
    backgroundColor: 'transparent',
  },
  routinesBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionLabel: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.five,
  },
  chipRow: { flexGrow: 0, flexShrink: 0, marginTop: Spacing.two },
  chipRowContent: { paddingHorizontal: Spacing.three, gap: Spacing.two, alignItems: 'center' },
  chip: {
    minHeight: 38,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    marginTop: Spacing.five,
  },
  suggestedRow: { flexGrow: 0, marginTop: Spacing.two },
  suggestedRowContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  suggestedCard: {
    width: 160,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    // The illustrations are white-background anatomical plates. Insetting them
    // on the card reads as a deliberate specimen tile instead of a bright
    // rectangle bleeding into the navy.
    padding: Spacing.one,
    ...CardShadow,
  },
  suggestedThumbnail: { width: '100%', height: 124, borderRadius: Radius.md },
  suggestedMeta: {
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    gap: Spacing.half,
  },
  suggestedName: { lineHeight: 18 },
});
