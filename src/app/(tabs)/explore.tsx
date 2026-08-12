import { eq, sql } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseRow } from '@/components/exercise-row';
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

const LIST_COLUMNS = { id: exercises.id, name: exercises.name, target: exercises.target };

export default function ExploreScreen() {
  const db = useCatalogDb();
  const theme = useTheme();
  const { t } = useTranslation();

  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedBodyPart, setSelectedBodyPart] = useState<string | null>(null);
  const [results, setResults] = useState<ExerciseListItem[]>([]);

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
        if (!cancelled) setResults(rows);
      })
      .catch((err) => console.error('[explore] query failed', err));
    return () => {
      cancelled = true;
    };
  }, [db, selectedBodyPart]);

  if (selectedBodyPart) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea} edges={['top']}>
          <Pressable onPress={() => setSelectedBodyPart(null)} style={styles.backRow} hitSlop={8}>
            <ThemedText type="smallBold" style={{ color: theme.accent }}>
              {'‹ '}
              {t('explore.back')}
            </ThemedText>
          </Pressable>
          <ThemedText type="subtitle" style={styles.selectedTitle}>
            {t(`bodyParts.${selectedBodyPart}`)}
          </ThemedText>
          <FlatList
            data={results}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <ExerciseRow item={item} />}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {t('exercises.noResults')}
              </ThemedText>
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
            <Pressable
              onPress={() => setSelectedBodyPart(bodyPart)}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: theme.backgroundElement, borderColor: theme.border },
                pressed && styles.pressed,
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
            </Pressable>
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
  pressed: { opacity: 0.85 },
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
