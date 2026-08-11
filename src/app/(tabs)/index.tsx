import { sql, eq } from 'drizzle-orm';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { GradientSurface } from '@/components/gradient-surface';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { exercises, ExerciseListItem, useCatalogDb } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';
import { mediaProvider } from '@/media';

// A handful of common groups, enough for quick access without crowding the screen.
const QUICK_MUSCLES = ['pectorals', 'abs', 'glutes', 'quads', 'upper_back', 'delts'] as const;

const LIST_COLUMNS = { id: exercises.id, name: exercises.name, target: exercises.target };
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
  const { t } = useTranslation();

  const greeting = useGreeting();
  const [motivationIndex, setMotivationIndex] = useState(1);

  const [activeMuscle, setActiveMuscle] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<ExerciseListItem[]>([]);

  async function fetchSuggested(muscle: string | null) {
    const rows = await db
      .select(LIST_COLUMNS)
      .from(exercises)
      .where(muscle ? eq(exercises.target, muscle) : undefined)
      .orderBy(sql`RANDOM()`)
      .limit(SUGGESTED_COUNT);
    setSuggested(rows);
  }

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const rows = await db
        .select(LIST_COLUMNS)
        .from(exercises)
        .orderBy(sql`RANDOM()`)
        .limit(SUGGESTED_COUNT);
      if (cancelled) return;
      setSuggested(rows);
      setMotivationIndex(1 + Math.floor(Math.random() * 4));
    }
    run().catch((err) => console.error('[home] query failed', err));
    return () => {
      cancelled = true;
    };
  }, [db]);

  function onChipPress(muscle: string) {
    const next = activeMuscle === muscle ? null : muscle;
    setActiveMuscle(next);
    fetchSuggested(next).catch((err) => console.error('[home] query failed', err));
  }

  function onShuffle() {
    fetchSuggested(activeMuscle).catch((err) => console.error('[home] query failed', err));
  }

  function onTrainNow() {
    if (suggested.length === 0) return;
    const pick = suggested[Math.floor(Math.random() * suggested.length)];
    router.push(`/exercise/${pick.id}`);
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
          <ThemedText type="small" themeColor="textSecondary" style={styles.greeting}>
            {greeting.toUpperCase()}
          </ThemedText>
          <ThemedText type="subtitle" style={styles.motivation}>
            {t(`home.motivation${motivationIndex}`)}
          </ThemedText>
        </ThemedView>

        <Animated.View style={pulseStyle}>
          <Pressable
            onPress={onTrainNow}
            style={({ pressed }) => [styles.ctaWrap, pressed && styles.pressed]}
          >
            <GradientSurface style={styles.ctaCard}>
              <ThemedView style={styles.ctaTextGroup}>
                <ThemedText type="subtitle" style={styles.ctaTitle}>
                  {t('home.ctaLabel')}
                </ThemedText>
                <ThemedText style={styles.ctaSubtitle}>{t('home.ctaHint')}</ThemedText>
              </ThemedView>
              <ThemedView style={styles.ctaBadge}>
                <ThemedText style={styles.ctaArrow}>→</ThemedText>
              </ThemedView>
            </GradientSurface>
          </Pressable>
        </Animated.View>

        <ThemedText type="smallBold" style={styles.sectionLabel}>
          {t('home.quickAccessTitle')}
        </ThemedText>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={QUICK_MUSCLES}
          keyExtractor={(m) => m}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
          renderItem={({ item: muscle }) => (
            <MuscleChip muscle={muscle} selected={activeMuscle === muscle} onPress={onChipPress} />
          )}
        />

        <ThemedView style={styles.sectionHeaderRow}>
          <ThemedText type="smallBold">
            {activeMuscle ? t(`muscles.${activeMuscle}`) : t('home.suggestedTitle')}
          </ThemedText>
          <Pressable onPress={onShuffle} hitSlop={10}>
            <ShuffleLabel />
          </Pressable>
        </ThemedView>

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={suggested}
          keyExtractor={(item) => item.id}
          style={styles.suggestedRow}
          contentContainerStyle={styles.suggestedRowContent}
          renderItem={({ item, index }) => <SuggestedCard item={item} index={index} />}
        />
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
    <Pressable
      onPress={() => onPress(muscle)}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? theme.accent : theme.backgroundElement,
          borderColor: selected ? theme.accent : theme.border,
        },
        pressed && styles.pressed,
      ]}
    >
      <ThemedText type="small" style={selected ? { color: theme.onAccent } : undefined}>
        {t(`muscles.${muscle}`)}
      </ThemedText>
    </Pressable>
  );
}

function SuggestedCard({ item, index }: { item: ExerciseListItem; index: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInRight.delay(index * 60).duration(320)}>
      <Pressable
        onPress={() => router.push(`/exercise/${item.id}`)}
        style={({ pressed }) => [
          styles.suggestedCard,
          { backgroundColor: theme.backgroundElement },
          pressed && styles.pressed,
        ]}
      >
        <Image
          source={mediaProvider.getThumbnail(item.id)}
          style={styles.suggestedThumbnail}
          contentFit="cover"
        />
        <ThemedView style={styles.suggestedMeta}>
          <ThemedText type="smallBold" numberOfLines={2} style={styles.suggestedName}>
            {item.name}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
            {t(`muscles.${item.target}`)}
          </ThemedText>
        </ThemedView>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  header: {
    paddingHorizontal: Spacing.three,
    paddingTop: Platform.select({ web: Spacing.six, default: Spacing.three }),
    gap: Spacing.half,
  },
  greeting: { letterSpacing: 1.2 },
  motivation: { lineHeight: 38 },
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
  ctaTitle: { color: '#FFFFFF', lineHeight: 38 },
  ctaSubtitle: { color: '#FFFFFF', opacity: 0.9, marginTop: Spacing.half },
  ctaBadge: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  ctaArrow: { color: '#FFFFFF', fontSize: 22, lineHeight: 26 },
  pressed: { opacity: 0.85 },
  sectionLabel: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.five,
  },
  chipRow: { flexGrow: 0, marginTop: Spacing.two },
  chipRowContent: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
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
    width: 156,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    ...CardShadow,
  },
  suggestedThumbnail: { width: '100%', height: 128 },
  suggestedMeta: {
    backgroundColor: 'transparent',
    padding: Spacing.two,
    gap: Spacing.half,
  },
  suggestedName: { lineHeight: 18 },
});
