import { inArray } from 'drizzle-orm';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ErrorState } from '@/components/error-state';
import { ExerciseRow } from '@/components/exercise-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { exercises, ExerciseRow as ExerciseRowType, searchExercises, useCatalogDb } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

import { resolveExercisePick } from '@/routine-picker-bridge';

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Text-search-only, unlike (tabs)/exercises.tsx's body-map browser — picking
 * an exercise for a routine you're actively building is a lookup ("bench
 * press", "leg curl"), not exploration. See routine-picker-bridge.ts for how the
 * chosen row gets back to routine/new.tsx.
 */
export default function PickExerciseScreen() {
  const db = useCatalogDb();
  const theme = useTheme();
  const { t } = useTranslation();

  const [searchText, setSearchText] = useState('');
  const [results, setResults] = useState<ExerciseRowType[]>([]);
  const [error, setError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const debounced = useDebouncedValue(searchText, 150);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const query = debounced.trim();
      let rows: ExerciseRowType[];
      if (query.length > 0) {
        const hits = await searchExercises(db, query, 50);
        const ids = hits.map((h) => h.id);
        const byId = new Map(
          ids.length > 0
            ? (await db.select().from(exercises).where(inArray(exercises.id, ids))).map((r) => [r.id, r])
            : [],
        );
        // searchExercises ranks by relevance — preserve that order rather
        // than the arbitrary order the IN (...) query happens to return.
        rows = ids.map((id) => byId.get(id)).filter((r): r is ExerciseRowType => r != null);
      } else {
        rows = await db.select().from(exercises).orderBy(exercises.name).limit(50);
      }

      if (!cancelled) {
        setResults(rows);
        setError(false);
      }
    }

    run().catch((err) => {
      console.error('[pick-exercise] query failed', err);
      if (!cancelled) setError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db, debounced, retryToken]);

  function pick(exercise: ExerciseRowType) {
    resolveExercisePick(exercise);
    router.back();
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="sectionTitle" style={styles.title}>
          {t('routine.pickExerciseTitle')}
        </ThemedText>
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder={t('exercises.searchPlaceholder')}
          placeholderTextColor={theme.textSecondary}
          style={[
            styles.searchInput,
            { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
          ]}
          autoCorrect={false}
          autoFocus
        />
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ExerciseRow item={item} onPress={() => pick(item)} />}
          contentContainerStyle={styles.listContent}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            error ? (
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

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  title: { marginHorizontal: Spacing.three, marginTop: Spacing.two },
  searchInput: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.two,
  },
  emptyText: { textAlign: 'center', marginTop: Spacing.five },
});
