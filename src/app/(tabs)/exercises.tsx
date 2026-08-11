import { eq, inArray } from 'drizzle-orm';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMapPager } from '@/components/body-map';
import { ExerciseRow } from '@/components/exercise-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { exercises, ExerciseListItem, searchExercises, useCatalogDb } from '@/db';
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

const CARDIO_MUSCLE = 'cardiovascular_system';

type FilterMode = 'list' | 'body';

// Only what ExerciseRow renders — see ExerciseListItem for why this matters.
const LIST_COLUMNS = { id: exercises.id, name: exercises.name, target: exercises.target };

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
  const [filterMode, setFilterMode] = useState<FilterMode>('list');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [results, setResults] = useState<ExerciseListItem[]>([]);
  const debouncedSearch = useDebouncedValue(searchText, 150);

  const synonymMuscle = useMemo(() => resolveMuscleSynonym(debouncedSearch), [debouncedSearch]);
  const effectiveMuscle = selectedMuscle ?? synonymMuscle;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const hasFreeTextQuery = debouncedSearch.trim().length > 0 && !synonymMuscle;

      let rows: ExerciseListItem[];
      if (hasFreeTextQuery) {
        const hits = await searchExercises(db, debouncedSearch, 100);
        const ids = hits.map((h) => h.id);
        if (ids.length === 0) {
          rows = [];
        } else {
          const byId = new Map(
            (
              await db.select(LIST_COLUMNS).from(exercises).where(inArray(exercises.id, ids))
            ).map((row) => [row.id, row]),
          );
          rows = ids.map((id) => byId.get(id)).filter((r): r is ExerciseListItem => r != null);
          if (effectiveMuscle) rows = rows.filter((r) => r.target === effectiveMuscle);
        }
      } else if (effectiveMuscle) {
        rows = await db
          .select(LIST_COLUMNS)
          .from(exercises)
          .where(eq(exercises.target, effectiveMuscle))
          .limit(200);
      } else {
        rows = await db.select(LIST_COLUMNS).from(exercises).orderBy(exercises.name).limit(200);
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

  function selectMuscle(muscle: string) {
    setSelectedMuscle((current) => (current === muscle ? null : muscle));
  }

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
            {
              color: theme.text,
              backgroundColor: theme.backgroundElement,
              borderColor: theme.border,
            },
          ]}
          autoCorrect={false}
        />

        <ThemedView
          type="backgroundElement"
          style={[styles.segmentedControl, { borderColor: theme.border }]}
        >
          <SegmentButton
            label={t('exercises.modeList')}
            selected={filterMode === 'list'}
            onPress={() => setFilterMode('list')}
          />
          <SegmentButton
            label={t('exercises.modeBody')}
            selected={filterMode === 'body'}
            onPress={() => setFilterMode('body')}
          />
        </ThemedView>

        {filterMode === 'list' ? (
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={MUSCLE_FILTERS}
            keyExtractor={(m) => m}
            style={styles.chipRow}
            contentContainerStyle={styles.chipRowContent}
            renderItem={({ item: muscle }) => (
              <FilterChip
                label={t(`muscles.${muscle}`)}
                selected={selectedMuscle === muscle}
                onPress={() => selectMuscle(muscle)}
              />
            )}
          />
        ) : (
          <ThemedView
            type="backgroundElement"
            style={[styles.bodyCard, { borderColor: theme.border }]}
          >
            <BodyMapPager selectedMuscle={selectedMuscle} onSelectMuscle={selectMuscle} />

            <FilterChip
              label={t(`muscles.${CARDIO_MUSCLE}`)}
              selected={selectedMuscle === CARDIO_MUSCLE}
              onPress={() => selectMuscle(CARDIO_MUSCLE)}
            />
          </ThemedView>
        )}

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

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
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
        {label}
      </ThemedText>
    </Pressable>
  );
}

function SegmentButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.segmentButton,
        { backgroundColor: selected ? theme.accent : 'transparent' },
      ]}
    >
      <ThemedText
        type="smallBold"
        style={selected ? { color: theme.onAccent } : { color: theme.textSecondary }}
      >
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  searchInput: {
    marginHorizontal: Spacing.three,
    marginTop: Platform.select({ web: Spacing.six, default: Spacing.three }),
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  segmentedControl: {
    flexDirection: 'row',
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.half,
    gap: Spacing.half,
  },
  segmentButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
  },
  chipRow: { flexGrow: 0, marginTop: Spacing.two },
  chipRowContent: { paddingHorizontal: Spacing.three, gap: Spacing.two },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  pressed: { opacity: 0.85 },
  bodyCard: {
    alignItems: 'center',
    marginHorizontal: Spacing.three,
    marginTop: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.two,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.five,
  },
});
