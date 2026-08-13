import { and, eq, inArray, sql } from 'drizzle-orm';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMapPicker } from '@/components/body-map';
import { ExerciseRow } from '@/components/exercise-row';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  EQUIPMENT_GROUP_ORDER,
  equipmentValuesFor,
  type EquipmentGroup,
} from '@/constants/equipment-groups';
import { BottomTabInset, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { exercises, ExerciseListItem, searchExercises, useCatalogDb } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { resolveMuscleSynonym } from '@/i18n/muscle-synonyms';
import { useTranslation } from '@/i18n/use-translation';
import { useGifPrefetch } from '@/media/use-gif-prefetch';

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

/** Tall enough for the 20pt line height of a chip label plus breathing room. */
const ChipHeight = 38;

type FilterMode = 'list' | 'body';

// Only what ExerciseRow renders — see ExerciseListItem for why this matters.
// mediaId rides along too: it's a short id, not one of the long text columns
// the comment on ExerciseListItem warns about, and it's what lets the list
// prefetch GIFs for whatever's actually on screen (see useGifPrefetch) — the
// GIF path itself is derived from it by MediaProvider, not stored.
const LIST_COLUMNS = {
  id: exercises.id,
  name: exercises.name,
  target: exercises.target,
  mediaId: exercises.mediaId,
};

type ResultRow = ExerciseListItem & { mediaId: string };

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
  // Opens on the body, not the list: almost nobody knows the muscle they want
  // to work is called the latissimus dorsi — they know they want a wider back.
  // A list of English names sorted alphabetically asks for the one thing the
  // user doesn't have, so the figure is the default way in and the list is the
  // fallback for people who already know what they're looking for.
  const [filterMode, setFilterMode] = useState<FilterMode>('body');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  // Multi-select: "what do I have access to" is rarely one answer — a home
  // setup is bodyweight *and* dumbbells *and* a band. Empty means no filter.
  const [equipmentGroups, setEquipmentGroups] = useState<EquipmentGroup[]>([]);
  const [results, setResults] = useState<ResultRow[]>([]);
  const { onViewableItemsChanged } = useGifPrefetch<ResultRow>((item) => item.mediaId);
  const [muscleCounts, setMuscleCounts] = useState<Record<string, number>>({});
  const debouncedSearch = useDebouncedValue(searchText, 150);

  const equipmentWhere = useMemo(
    () =>
      equipmentGroups.length > 0
        ? inArray(exercises.equipment, equipmentValuesFor(equipmentGroups))
        : undefined,
    [equipmentGroups],
  );

  // Feeds the body map's caption. One aggregate for the whole catalog, held for
  // the life of the screen — the counts can't change, the catalog is read-only.
  useEffect(() => {
    db.select({ target: exercises.target, count: sql<number>`count(*)` })
      .from(exercises)
      .groupBy(exercises.target)
      .then((rows) => setMuscleCounts(Object.fromEntries(rows.map((r) => [r.target, r.count]))))
      .catch((err) => console.error('[exercises] count query failed', err));
  }, [db]);

  const synonymMuscle = useMemo(() => resolveMuscleSynonym(debouncedSearch), [debouncedSearch]);
  const effectiveMuscle = selectedMuscle ?? synonymMuscle;

  useEffect(() => {
    let cancelled = false;

    async function run() {
      const hasFreeTextQuery = debouncedSearch.trim().length > 0 && !synonymMuscle;

      let rows: ResultRow[];
      if (hasFreeTextQuery) {
        const hits = await searchExercises(db, debouncedSearch, 100);
        const ids = hits.map((h) => h.id);
        if (ids.length === 0) {
          rows = [];
        } else {
          // Equipment is filtered in SQL here rather than over `rows`, so a
          // narrow equipment choice can't be defeated by the FTS limit above.
          const byId = new Map(
            (
              await db
                .select(LIST_COLUMNS)
                .from(exercises)
                .where(and(inArray(exercises.id, ids), equipmentWhere))
            ).map((row) => [row.id, row]),
          );
          rows = ids.map((id) => byId.get(id)).filter((r): r is ResultRow => r != null);
          if (effectiveMuscle) rows = rows.filter((r) => r.target === effectiveMuscle);
        }
      } else if (effectiveMuscle) {
        rows = await db
          .select(LIST_COLUMNS)
          .from(exercises)
          .where(and(eq(exercises.target, effectiveMuscle), equipmentWhere))
          .limit(200);
      } else {
        rows = await db
          .select(LIST_COLUMNS)
          .from(exercises)
          .where(equipmentWhere)
          .orderBy(exercises.name)
          .limit(200);
      }

      if (!cancelled) setResults(rows);
    }

    run().catch((err) => {
      console.error('[exercises] query failed', err);
    });
    return () => {
      cancelled = true;
    };
  }, [db, debouncedSearch, effectiveMuscle, synonymMuscle, equipmentWhere]);

  function selectMuscle(muscle: string) {
    setSelectedMuscle((current) => (current === muscle ? null : muscle));
  }

  function toggleEquipment(group: EquipmentGroup) {
    setEquipmentGroups((current) =>
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group],
    );
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

        {/* Equipment is orthogonal to which muscle you picked, so it stays put
            across both modes rather than belonging to either one. */}
        <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.filterLabel}>
          {t('exercises.equipmentLabel').toUpperCase()}
        </ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}
          contentContainerStyle={styles.chipRowContent}
        >
          {EQUIPMENT_GROUP_ORDER.map((group) => (
            <FilterChip
              key={group}
              label={t(`equipmentGroups.${group}`)}
              selected={equipmentGroups.includes(group)}
              onPress={() => toggleEquipment(group)}
            />
          ))}
        </ScrollView>

        {filterMode === 'list' ? (
          // A plain ScrollView, not a FlatList: the filter set is 19 fixed text
          // pills, so windowing them costs more per scroll frame than simply
          // keeping them all mounted.
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipRowContent}
          >
            {MUSCLE_FILTERS.map((muscle) => (
              <FilterChip
                key={muscle}
                label={t(`muscles.${muscle}`)}
                selected={selectedMuscle === muscle}
                onPress={() => selectMuscle(muscle)}
              />
            ))}
          </ScrollView>
        ) : null}

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ExerciseRow item={item} />}
          onViewableItemsChanged={onViewableItemsChanged}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          // Defaults keep ~10 screens of rows mounted either side, and every row
          // carries a decoded thumbnail. Three screens of buffer is still well
          // ahead of a fast fling at a fraction of the mounted-view count.
          windowSize={7}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={50}
          // Android only: on iOS this is a known source of blank cells.
          removeClippedSubviews={Platform.OS === 'android'}
          // Results arrive under an open keyboard, so a scroll should dismiss it
          // and a tap on a row should land on the first try, not the second.
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          // The plate rides along as a list header so it scrolls out of the
          // way. Pinned above the list it kept ~400dp of the screen to itself,
          // leaving room for barely two results.
          ListHeaderComponent={
            filterMode === 'body' ? (
              <ThemedView
                type="backgroundElement"
                style={[styles.bodyCard, { borderColor: theme.border }]}
              >
                <BodyMapPicker
                  selectedMuscle={selectedMuscle}
                  onSelectMuscle={setSelectedMuscle}
                  counts={muscleCounts}
                />

                {/* Cardio has no region on the figure, so it needs its own way in. */}
                <FilterChip
                  label={t(`muscles.${CARDIO_MUSCLE}`)}
                  selected={selectedMuscle === CARDIO_MUSCLE}
                  onPress={() => selectMuscle(CARDIO_MUSCLE)}
                />
              </ThemedView>
            ) : null
          }
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
    <PressableScale
      onPress={onPress}
      scaleTo={0.94}
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
        {label}
      </ThemedText>
    </PressableScale>
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
    <PressableScale
      onPress={onPress}
      scaleTo={0.96}
      style={[styles.segmentButton, { backgroundColor: selected ? theme.accent : 'transparent' }]}
    >
      {/* Unlike the filter chips, this is a binary toggle — the inactive half
          should recede rather than read as an equal option. */}
      <ThemedText
        type="smallBold"
        style={{ color: selected ? theme.onAccent : theme.textSecondary }}
      >
        {label}
      </ThemedText>
    </PressableScale>
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
  // flexShrink: 0 keeps the row at its natural height — without it the column
  // squeezes the chips and clips their text once the list below competes for
  // space (most visibly with the keyboard open).
  filterLabel: {
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
  },
  chipRow: { flexGrow: 0, flexShrink: 0, marginTop: Spacing.two },
  chipRowContent: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.two,
    alignItems: 'center',
  },
  chip: {
    minHeight: ChipHeight,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  // Sits inside the results list, so its horizontal insets come from
  // `listContent` rather than its own margins.
  bodyCard: {
    alignItems: 'center',
    paddingVertical: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: Spacing.two,
  },
  list: { flex: 1 },
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
