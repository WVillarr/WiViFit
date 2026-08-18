import { and, eq, exists, inArray, or, sql } from 'drizzle-orm';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMapPicker } from '@/components/body-map';
import { ErrorState } from '@/components/error-state';
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
import {
  type Difficulty,
  exerciseSecondaryMuscles,
  exercises,
  ExerciseListItem,
  MOVEMENT_PATTERNS,
  type MovementPattern,
  muscleCounts as muscleCountsTable,
  searchExercises,
  secondaryAliasesFor,
  useCatalogDb,
} from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { resolveMuscleSynonym } from '@/i18n/muscle-synonyms';
import { useTranslation } from '@/i18n/use-translation';
import { useGifPrefetch } from '@/media/use-gif-prefetch';

const DIFFICULTIES: Difficulty[] = [1, 2, 3];

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
  nameEs: exercises.nameEs,
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
  // Only meaningful once a muscle is chosen — the effect it has is a body-map
  // caption number moving (e.g. "151" -> "345"), so it's hidden rather than
  // disabled when there's nothing for it to change yet.
  const [includeSecondary, setIncludeSecondary] = useState(false);
  const [patterns, setPatterns] = useState<MovementPattern[]>([]);
  const [difficulties, setDifficulties] = useState<Difficulty[]>([]);
  const [facetsExpanded, setFacetsExpanded] = useState(false);
  const [results, setResults] = useState<ResultRow[]>([]);
  const [resultsError, setResultsError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);
  const { onViewableItemsChanged } = useGifPrefetch<ResultRow>((item) => item.mediaId);
  const [muscleCountRows, setMuscleCountRows] = useState<
    Record<string, { primary: number; inclusive: number }>
  >({});
  const debouncedSearch = useDebouncedValue(searchText, 150);

  const equipmentWhere = useMemo(
    () =>
      equipmentGroups.length > 0
        ? inArray(exercises.equipment, equipmentValuesFor(equipmentGroups))
        : undefined,
    [equipmentGroups],
  );

  // Equipment/pattern/difficulty are orthogonal to which muscle is selected,
  // so they compose with an AND regardless of which of the three query shapes
  // below is running.
  const facetWhere = useMemo(
    () =>
      and(
        equipmentWhere,
        patterns.length > 0 ? inArray(exercises.movementPattern, patterns) : undefined,
        difficulties.length > 0 ? inArray(exercises.difficulty, difficulties) : undefined,
      ),
    [equipmentWhere, patterns, difficulties],
  );

  // Precomputed at build time (see muscle_counts in catalog-schema.ts) rather
  // than aggregated here — one read instead of a GROUP BY on every mount, and
  // it's what makes the secondary toggle's number swap instant instead of a
  // second round trip.
  useEffect(() => {
    db.select({
      target: muscleCountsTable.target,
      primary: muscleCountsTable.primaryCount,
      inclusive: muscleCountsTable.inclusiveCount,
    })
      .from(muscleCountsTable)
      .then((rows) =>
        setMuscleCountRows(
          Object.fromEntries(rows.map((r) => [r.target, { primary: r.primary, inclusive: r.inclusive }])),
        ),
      )
      .catch((err) => console.error('[exercises] count query failed', err));
  }, [db]);

  const displayedMuscleCounts = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(muscleCountRows).map(([target, c]) => [
          target,
          includeSecondary ? c.inclusive : c.primary,
        ]),
      ),
    [muscleCountRows, includeSecondary],
  );

  const synonymMuscle = useMemo(() => resolveMuscleSynonym(debouncedSearch), [debouncedSearch]);
  const effectiveMuscle = selectedMuscle ?? synonymMuscle;

  // eq(target, muscle) when the toggle is off; with it on, also match any
  // exercise where the muscle shows up as a secondary — secondaryAliasesFor
  // always includes the target itself, so this still degrades to a plain
  // eq() in the SQL sense, just expressed as an OR.
  const muscleWhere = useMemo(() => {
    if (!effectiveMuscle) return undefined;
    if (!includeSecondary) return eq(exercises.target, effectiveMuscle);
    return or(
      eq(exercises.target, effectiveMuscle),
      exists(
        db
          .select({ hit: sql`1` })
          .from(exerciseSecondaryMuscles)
          .where(
            and(
              eq(exerciseSecondaryMuscles.exerciseId, exercises.id),
              inArray(exerciseSecondaryMuscles.muscle, secondaryAliasesFor(effectiveMuscle)),
            ),
          ),
      ),
    );
  }, [db, effectiveMuscle, includeSecondary]);

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
          // Every filter is applied in SQL here rather than over `rows`, so a
          // narrow filter can't be defeated by the FTS LIMIT above — and the
          // secondary-muscle toggle couldn't be expressed as a JS post-filter
          // on `target` at all.
          const byId = new Map(
            (
              await db
                .select(LIST_COLUMNS)
                .from(exercises)
                .where(and(inArray(exercises.id, ids), facetWhere, muscleWhere))
            ).map((row) => [row.id, row]),
          );
          rows = ids.map((id) => byId.get(id)).filter((r): r is ResultRow => r != null);
        }
      } else if (effectiveMuscle) {
        rows = await db
          .select(LIST_COLUMNS)
          .from(exercises)
          .where(and(muscleWhere, facetWhere))
          .limit(200);
      } else {
        rows = await db
          .select(LIST_COLUMNS)
          .from(exercises)
          .where(facetWhere)
          .orderBy(exercises.name)
          .limit(200);
      }

      if (!cancelled) {
        setResults(rows);
        setResultsError(false);
      }
    }

    run().catch((err) => {
      console.error('[exercises] query failed', err);
      if (!cancelled) setResultsError(true);
    });
    return () => {
      cancelled = true;
    };
  }, [db, debouncedSearch, effectiveMuscle, synonymMuscle, facetWhere, muscleWhere, retryToken]);

  function selectMuscle(muscle: string) {
    setSelectedMuscle((current) => (current === muscle ? null : muscle));
  }

  function toggleEquipment(group: EquipmentGroup) {
    setEquipmentGroups((current) =>
      current.includes(group) ? current.filter((g) => g !== group) : [...current, group],
    );
  }

  function togglePattern(pattern: MovementPattern) {
    setPatterns((current) =>
      current.includes(pattern) ? current.filter((p) => p !== pattern) : [...current, pattern],
    );
  }

  function toggleDifficulty(difficulty: Difficulty) {
    setDifficulties((current) =>
      current.includes(difficulty) ? current.filter((d) => d !== difficulty) : [...current, difficulty],
    );
  }

  const activeFacetCount = patterns.length + difficulties.length;

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

        <ThemedView style={styles.facetRow}>
          <PressableScale
            onPress={() => setFacetsExpanded((v) => !v)}
            scaleTo={0.96}
            accessibilityRole="button"
            accessibilityState={{ expanded: facetsExpanded }}
            style={[
              styles.facetToggle,
              // A tint, not a fill: the accent already marks every selected
              // chip on this screen, and three solid greens on one row (this
              // pill, the secondary toggle, a selected muscle chip) would
              // blur which one means what. See theme.ts — green stays scarce.
              activeFacetCount > 0
                ? { backgroundColor: theme.accentSoft, borderColor: theme.accentSoft }
                : { backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          >
            <ThemedText
              type={activeFacetCount > 0 ? 'smallBold' : 'small'}
              style={{ color: activeFacetCount > 0 ? theme.accent : theme.text }}
            >
              {activeFacetCount > 0
                ? `${t('exercises.filters')} · ${activeFacetCount}`
                : t('exercises.filters')}
              {facetsExpanded ? ' ▾' : ' ▸'}
            </ThemedText>
          </PressableScale>

          {/* Its only visible effect is the body-map caption's count moving
              (e.g. 151 -> 345), so it's hidden rather than disabled until
              there's a muscle selected for it to act on. */}
          {effectiveMuscle && (
            <FilterChip
              label={t('exercises.includeSecondary')}
              selected={includeSecondary}
              onPress={() => setIncludeSecondary((v) => !v)}
            />
          )}
        </ThemedView>

        {facetsExpanded && (
          <ThemedView style={styles.facetPanel}>
            <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.filterLabel}>
              {t('exercises.patternLabel').toUpperCase()}
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
              contentContainerStyle={styles.chipRowContent}
            >
              {MOVEMENT_PATTERNS.map((pattern) => (
                <FilterChip
                  key={pattern}
                  label={t(`movementPatterns.${pattern}`)}
                  selected={patterns.includes(pattern)}
                  onPress={() => togglePattern(pattern)}
                />
              ))}
            </ScrollView>

            <ThemedText type="eyebrow" themeColor="textSecondary" style={styles.filterLabel}>
              {t('exercises.difficultyLabel').toUpperCase()}
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.chipRow}
              contentContainerStyle={styles.chipRowContent}
            >
              {DIFFICULTIES.map((difficulty) => (
                <FilterChip
                  key={difficulty}
                  label={t(`difficulty.${difficulty}`)}
                  selected={difficulties.includes(difficulty)}
                  onPress={() => toggleDifficulty(difficulty)}
                />
              ))}
            </ScrollView>

            {activeFacetCount > 0 && (
              <PressableScale
                onPress={() => {
                  setPatterns([]);
                  setDifficulties([]);
                }}
                scaleTo={0.94}
                style={styles.clearFacetsButton}
              >
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  {t('exercises.clearFilters')}
                </ThemedText>
              </PressableScale>
            )}
          </ThemedView>
        )}

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
          //
          // Hidden rather than unmounted in list mode. The pager holds both the
          // front and back plates, which between them are ~160 <Path> views,
          // each with its own press handler; tearing that down and building it
          // again is a single synchronous pass long enough to visibly freeze
          // the screen on the way back to the figure. `display: 'none'` drops
          // the subtree out of layout, so the hidden plate takes up no space
          // and costs nothing to reveal.
          ListHeaderComponent={
            <ThemedView
              type="backgroundElement"
              style={[
                styles.bodyCard,
                { borderColor: theme.border },
                filterMode !== 'body' && styles.bodyCardHidden,
              ]}
            >
              <BodyMapPicker
                selectedMuscle={selectedMuscle}
                onSelectMuscle={setSelectedMuscle}
                counts={displayedMuscleCounts}
              />

              {/* Cardio has no region on the figure, so it needs its own way in. */}
              <FilterChip
                label={t(`muscles.${CARDIO_MUSCLE}`)}
                selected={selectedMuscle === CARDIO_MUSCLE}
                onPress={() => selectMuscle(CARDIO_MUSCLE)}
              />
            </ThemedView>
          }
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
      accessibilityRole="button"
      accessibilityState={{ selected }}
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
  facetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
  },
  facetToggle: {
    minHeight: ChipHeight,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three + Spacing.half,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  facetPanel: {
    marginTop: Spacing.two,
    gap: Spacing.half,
  },
  clearFacetsButton: {
    alignSelf: 'flex-end',
    marginHorizontal: Spacing.three,
    marginTop: Spacing.one,
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
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
  bodyCardHidden: { display: 'none' },
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
