import { and, eq, ne, sql } from 'drizzle-orm';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ExerciseAnatomy } from '@/components/body-map';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import {
  exerciseSecondaryMuscles,
  exercises,
  ExerciseListItem,
  ExerciseRow,
  recordView,
  useCatalogDb,
  useFavorites,
  useUserDb,
} from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';
import { mediaProvider } from '@/media';

export default function ExerciseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useCatalogDb();
  const userDb = useUserDb();
  const theme = useTheme();
  const { t, locale } = useTranslation();
  const { isFavorite, toggle } = useFavorites();

  const [exercise, setExercise] = useState<ExerciseRow | null>(null);
  const [secondaryMuscles, setSecondaryMuscles] = useState<string[]>([]);
  const [alternatives, setAlternatives] = useState<ExerciseListItem[]>([]);

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

  // One write per visit, not per render — keyed on `id` rather than the
  // fetched `exercise` so revisiting the same screen with a new id (the
  // alternatives row uses `router.replace`) still logs each stop.
  useEffect(() => {
    recordView(userDb, id);
  }, [userDb, id]);

  // "The bench is taken, what else can I do?" — same muscle, same movement
  // pattern, different equipment. The enrichment from Fase 1 is what makes this
  // answerable without any new data.
  useEffect(() => {
    if (!exercise) return;
    let cancelled = false;
    db.select({ id: exercises.id, name: exercises.name, target: exercises.target })
      .from(exercises)
      .where(
        and(
          eq(exercises.target, exercise.target),
          eq(exercises.movementPattern, exercise.movementPattern),
          ne(exercises.equipment, exercise.equipment),
        ),
      )
      .orderBy(sql`RANDOM()`)
      .limit(8)
      .then((rows) => {
        if (!cancelled) setAlternatives(rows);
      })
      .catch((err) => console.error('[exercise] alternatives query failed', err));
    return () => {
      cancelled = true;
    };
  }, [db, exercise]);

  const steps = useMemo<string[]>(
    () =>
      exercise
        ? JSON.parse(locale === 'es' ? exercise.instructionStepsEs : exercise.instructionStepsEn)
        : [],
    [exercise, locale],
  );

  // The row that pushed this screen has already started animating, so returning
  // nothing would slide an empty card in and pop the content on afterwards.
  // Blocking out the same shapes keeps the transition landing on a page.
  if (!exercise) return <DetailSkeleton />;

  return (
    <ScrollView contentContainerStyle={styles.scroll}>
      <ThemedView style={styles.content}>
        <View>
          <Image
            source={{ uri: mediaProvider.getGifUri(exercise.gifPath) }}
            // The bundled thumbnail as placeholder, not a blank tile: the GIF
            // is hot-linked (see MediaProvider) and won't load offline the
            // first time a card is opened, but the thumbnail always will.
            placeholder={mediaProvider.getThumbnail(exercise.id)}
            placeholderContentFit="cover"
            style={[styles.gif, { backgroundColor: theme.backgroundElement }]}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
          />
          <PressableScale
            onPress={() => toggle(exercise.id)}
            scaleTo={0.9}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t(
              isFavorite(exercise.id) ? 'exercise.unfavorite' : 'exercise.favorite',
            )}
            accessibilityState={{ selected: isFavorite(exercise.id) }}
            style={[styles.favoriteButton, { backgroundColor: theme.background }]}
          >
            <ThemedText style={{ color: isFavorite(exercise.id) ? theme.accent : theme.text }}>
              {isFavorite(exercise.id) ? '★' : '☆'}
            </ThemedText>
          </PressableScale>
        </View>

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

        {/* The plate says which muscles at a glance; the list underneath names
            them, since knowing the word is half of what the app teaches. */}
        <ThemedView style={styles.section}>
          <ThemedText type="sectionTitle">{t('exercise.musclesWorked')}</ThemedText>
          <ExerciseAnatomy target={exercise.target} secondaryMuscles={secondaryMuscles} />
          {secondaryMuscles.length > 0 && (
            <ThemedText themeColor="textSecondary" style={styles.secondaryList}>
              {secondaryMuscles.map((m) => t(`muscles.${m}`)).join(' · ')}
            </ThemedText>
          )}
        </ThemedView>

        <ThemedView style={styles.section}>
          <ThemedText type="sectionTitle">{t('exercise.instructions')}</ThemedText>
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

        {alternatives.length > 0 && (
          <ThemedView style={styles.section}>
            <ThemedText type="sectionTitle">{t('exercise.alternatives')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('exercise.alternativesHint')}
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.alternativesRow}
              contentContainerStyle={styles.alternativesContent}
            >
              {alternatives.map((item) => (
                <AlternativeCard key={item.id} item={item} />
              ))}
            </ScrollView>
          </ThemedView>
        )}

        <ThemedText type="small" themeColor="textSecondary" style={styles.attribution}>
          {t('exercise.attributionPrefix')} {exercise.attribution}
        </ThemedText>
      </ThemedView>
    </ScrollView>
  );
}

/** The page's own silhouette, held while the catalog row loads. */
function DetailSkeleton() {
  const theme = useTheme();
  return (
    <ThemedView style={styles.skeletonPage}>
      <ThemedView style={styles.content}>
        <ThemedView style={[styles.gif, { backgroundColor: theme.backgroundElement }]} />
        <ThemedView style={[styles.skeletonTitle, { backgroundColor: theme.backgroundElement }]} />
        <View style={styles.metaRow}>
          {[0, 1, 2].map((i) => (
            <ThemedView
              key={i}
              style={[styles.skeletonChip, { backgroundColor: theme.backgroundElement }]}
            />
          ))}
        </View>
      </ThemedView>
    </ThemedView>
  );
}

/** `replace` rather than `push`: hopping between alternatives shouldn't build
 *  a back stack the user has to unwind one card at a time. */
function AlternativeCard({ item }: { item: ExerciseListItem }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <PressableScale
      onPress={() => router.replace(`/exercise/${item.id}`)}
      style={[styles.altCard, { backgroundColor: theme.backgroundElement }]}
    >
      <Image
        source={mediaProvider.getThumbnail(item.id)}
        style={[styles.altThumbnail, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        recyclingKey={item.id}
        transition={150}
        cachePolicy="memory-disk"
      />
      <ThemedView style={styles.altMeta}>
        <ThemedText type="smallBold" numberOfLines={2} style={styles.altName}>
          {item.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {t(`muscles.${item.target}`)}
        </ThemedText>
      </ThemedView>
    </PressableScale>
  );
}

/** Value first, label under it — the reading order you want mid-set. */
function MetaChip({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={[styles.metaChip, { borderColor: theme.border }]}>
      <ThemedText type="sectionTitle" numberOfLines={2} style={styles.metaValue}>
        {value}
      </ThemedText>
      <ThemedText
        type="eyebrow"
        themeColor="textSecondary"
        numberOfLines={1}
        style={styles.metaLabel}
      >
        {label.toUpperCase()}
      </ThemedText>
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
  favoriteButton: {
    position: 'absolute',
    top: Spacing.two,
    right: Spacing.two,
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    ...CardShadow,
  },
  skeletonPage: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
  },
  skeletonTitle: {
    width: '70%',
    height: 38,
    borderRadius: Radius.sm,
  },
  // Roughly a MetaChip with a single-line value — close enough that the real
  // row settling in doesn't read as a jump.
  skeletonChip: {
    flex: 1,
    height: 86,
    borderRadius: Radius.md,
  },
  title: {
    textTransform: 'capitalize',
    lineHeight: 38,
  },
  metaRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  metaChip: {
    flex: 1,
    alignItems: 'center',
    // Values run to one or two lines depending on the word; anchoring to the
    // bottom keeps the three labels on a single baseline across the row.
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.one,
  },
  metaValue: { textAlign: 'center' },
  // Tighter than the default eyebrow so "TARGET MUSCLE" clears a third of the row.
  metaLabel: { textAlign: 'center', fontSize: 10, letterSpacing: 0.6 },
  section: {
    gap: Spacing.two,
  },
  secondaryList: { textAlign: 'center' },
  alternativesRow: { flexGrow: 0, marginTop: Spacing.one },
  alternativesContent: { gap: Spacing.three, paddingVertical: Spacing.one },
  altCard: {
    width: 148,
    borderRadius: Radius.lg,
    overflow: 'hidden',
    padding: Spacing.one,
    ...CardShadow,
  },
  altThumbnail: { width: '100%', height: 112, borderRadius: Radius.md },
  altMeta: {
    backgroundColor: 'transparent',
    paddingHorizontal: Spacing.one,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.one,
    gap: Spacing.half,
  },
  altName: { lineHeight: 18 },
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
