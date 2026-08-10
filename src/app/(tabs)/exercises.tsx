import { eq, inArray } from 'drizzle-orm';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseRow } from '@/components/exercise-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { exercises, ExerciseRow as ExerciseRowData, searchExercises, useCatalogDb } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { resolveMuscleSynonym } from '@/i18n/muscle-synonyms';
import { useTranslation } from '@/i18n/use-translation';

// Ordered roughly by how many exercises target them, so the most useful
// filters are reachable without scrolling.
const MUSCLE_FILTERS = [
  'abs',
  'pectorals',
  'biceps',
  'glutes',
  'delts',
  'triceps',
  'upper_back',
  'lats',
  'calves',
  'quads',
  'forearms',
  'cardiovascular_system',
  'hamstrings',
  'spine',
  'traps',
  'adductors',
  'abductors',
  'serratus_anterior',
  'levator_scapulae',
] as const;

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export default function ExercisesScreen() {
  const db = useCatalogDb();
  const theme = useTheme();
  const { t } = useTranslation();

  const [searchText, setSearchText] = useState('');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [results, setResults] = useState<ExerciseRowData[]>([]);
  const debouncedSearch = useDebouncedValue(searchText, 150);

  const synonymMuscle = useMemo(() => resolveMuscleSynonym(debouncedSearch), [debouncedSearch]);
  const effectiveMuscle = selectedMuscle ?? synonymMuscle;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const hasFreeTextQuery = debouncedSearch.trim().length > 0 && !synonymMuscle;

      let rows: ExerciseRowData[];
      if (hasFreeTextQuery) {
        const hits = await searchExercises(db, debouncedSearch, 100);
        const ids = hits.map((h) => h.id);
        if (ids.length === 0) {
          rows = [];
        } else {
          const byId = new Map(
            (await db.select().from(exercises).where(inArray(exercises.id, ids))).map((row) => [
              row.id,
              row,
            ]),
          );
          rows = ids.map((id) => byId.get(id)).filter((r): r is ExerciseRowData => r != null);
          if (effectiveMuscle) rows = rows.filter((r) => r.target === effectiveMuscle);
        }
      } else if (effectiveMuscle) {
        rows = await db
          .select()
          .from(exercises)
          .where(eq(exercises.target, effectiveMuscle))
          .limit(200);
      } else {
        rows = await db.select().from(exercises).orderBy(exercises.name).limit(200);
      }

      if (!cancelled) setResults(rows);
    }

    run().catch((err) => {
      console.error('[exercises] query failed', err);
    });
    return () => {
      cancelled = true;
    };
  }, [db, debouncedSearch, effectiveMuscle, synonymMuscle]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t('exercises.searchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.searchInput,
            { color: theme.text, backgroundColor: theme.backgroundElement },
          ]}
          autoCorrect={false}
        />

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={MUSCLE_FILTERS}
          keyExtractor={(m) => m}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
          renderItem={({ item: muscle }) => {
            const selected = selectedMuscle === muscle;
            return (
              <Pressable
                onPress={() => setSelectedMuscle(selected ? null : muscle)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: selected ? theme.backgroundSelected : theme.backgroundElement,
                  },
                ]}
              >
                <ThemedText type="small">{t(`muscles.${muscle}`)}</ThemedText>
              </Pressable>
            );
          }}
        />

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

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  searchInput: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    fontSize: 16,
  },
  chipRow: { flexGrow: 0, marginTop: Spacing.two },
  chipRowContent: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.one,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.six,
  },
});
