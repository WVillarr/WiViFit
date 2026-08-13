import { eq, sql } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { FlatList, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { ExerciseRow, exerciseRowLayout } from '@/components/exercise-row';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { ExerciseListItem, exercises, useCatalogDb } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

const BODY_PARTS = [
  'back',
  'cardio',
  'chest',
  'lower_arms',
  'lower_legs',
  'neck',
  'shoulders',
  'upper_arms',
  'upper_legs',
  'waist',
] as const;

const LIST_COLUMNS = {
  id: exercises.id,
  name: exercises.name,
  nameEs: exercises.nameEs,
  target: exercises.target,
};

/** Must stay in step with `styles.listContent` — see `exerciseRowLayout`. */
const ROW_LAYOUT = exerciseRowLayout(Spacing.two);

export default function ExploreScreen() {
  const db = useCatalogDb();
  const theme = useTheme();
  const { t } = useTranslation();

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [results, setResults] = useState<ExerciseListItem[]>([]);
  const [resultsError, setResultsError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    db.select({ bodyPart: exercises.bodyPart, count: sql<number>`count(*)` })
      .from(exercises)
      .groupBy(exercises.bodyPart)
      .then((rows) => {
        setCounts(Object.fromEntries(rows.map((r) => [r.bodyPart, r.count])));
      })
      .catch((err) => console.error('[explore] count query failed', err));
  }, [db]);

  useEffect(() => {
    if (!selectedBodyPart) return;
    let cancelled = false;
    db.select(LIST_COLUMNS)
      .from(exercises)
      .where(eq(exercises.bodyPart, selectedBodyPart))
      .orderBy(exercises.name)
      .limit(200)
      .then((rows) => {
        if (!cancelled) {
          setResults(rows);
          setResultsError(false);
        }
      })
      .catch((err) => {
        console.error('[explore] query failed', err);
        if (!cancelled) setResultsError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [db, selectedBodyPart, retryToken]);

  if (selectedBodyPart) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <PressableScale
            onPress={() => setSelectedBodyPart(null)}
            style={styles.backRow}
            scaleTo={0.94}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('explore.back')}
          >
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              {'‹ '}
              {t('explore.back')}
            </ThemedText>
          </PressableScale>
          <ThemedText type="subtitle" style={styles.selectedTitle}>
            {t(`bodyParts.${selectedBodyPart}`)}
          </ThemedText>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ExerciseRow item={item} />}
            contentContainerStyle={styles.listContent}
            // Rows are a fixed height, so VirtualizedList can be told exactly
            // where each one sits instead of measuring them as they mount.
            getItemLayout={ROW_LAYOUT}
            windowSize={7}
            initialNumToRender={8}
            maxToRenderPerBatch={8}
            updateCellsBatchingPeriod={50}
            removeClippedSubviews={Platform.OS === 'android'}
            ListEmptyComponent={
              resultsError ? (
                <ErrorState onRetry={() => setRetryToken((n) => n + 1)} />
              ) : (
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {t('exercises.noResults')}
                </ThemedText>
              )
            }
          />
        </SafeAreaView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">{t('explore.title')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('explore.subtitle')}</ThemedText>
        </ThemedView>
        <FlatList
          data={BODY_PARTS}
          keyExtractor={(item) => item}
          numColumns={2}
          contentContainerStyle={styles.gridContent}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item: bodyPart }) => (
            <PressableScale
              onPress={() => setSelectedBodyPart(bodyPart)}
              accessibilityRole="button"
              accessibilityLabel={
                counts[bodyPart] != null
                  ? `${t(`bodyParts.${bodyPart}`)}, ${t('exercises.resultsCount', { count: counts[bodyPart] })}`
                  : t(`bodyParts.${bodyPart}`)
              }
              style={[
                styles.tile,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
              ]}
            >
              <ThemedView style={[styles.tileDot, { backgroundColor: theme.accentSoft }]}>
                <ThemedView style={[styles.tileDotInner, { backgroundColor: theme.accent }]} />
              </ThemedView>
              <ThemedText type="sectionTitle" numberOfLines={1}>
                {t(`bodyParts.${bodyPart}`)}
              </ThemedText>
              {counts[bodyPart] != null && (
                <ThemedText type="small" themeColor="textSecondary">
                  {t('exercises.resultsCount', { count: counts[bodyPart] })}
                </ThemedText>
              )}
            </PressableScale>
          )}
        />
      </SafeAreaView>
    </ThemedView>
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
  gridContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.three,
  },
  gridRow: { gap: Spacing.three },
  tile: {
    flex: 1,
    aspectRatio: 3 / 2,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    justifyContent: 'flex-end',
    gap: Spacing.half,
  },
  tileDot: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    width: 34,
    height: 34,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileDotInner: { width: 12, height: 12, borderRadius: Radius.pill },
  backRow: {
    paddingHorizontal: Spacing.three,
    paddingTop: Platform.select({ web: Spacing.six, default: Spacing.three }),
  },
  selectedTitle: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.one,
    paddingBottom: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
});
