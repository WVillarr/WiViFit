import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { ExerciseListItem } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';
import { mediaProvider } from '@/media';

/**
 * Fixed so every row is the same height whether or not the name wraps to a
 * second line. Uniform rows are what let a list hand VirtualizedList exact
 * offsets instead of measuring each cell — see `exerciseRowLayout`.
 *
 * 78 = the tallest content (two 20pt name lines + 2 gap + a 20pt subtitle)
 * plus `Spacing.two` of padding top and bottom.
 */
export const EXERCISE_ROW_HEIGHT = 78;

/** The vertical gap a list must put between rows for `exerciseRowLayout` to hold. */
export const EXERCISE_ROW_GAP = Spacing.two;

/**
 * Builds a `getItemLayout` for a list of `ExerciseRow`s, skipping the per-cell
 * measurement pass that makes a fast fling stutter into blank space.
 *
 * `paddingTop` must match the list's `contentContainerStyle.paddingTop` and the
 * rows must be spaced with `EXERCISE_ROW_GAP`: a cell's measured offset includes
 * its container's padding, so these have to agree or scroll positions drift.
 * Only usable on a list with no `ListHeaderComponent` — a header shifts every
 * offset by a height this can't know.
 */
export function exerciseRowLayout(paddingTop: number) {
  return (_data: unknown, index: number) => ({
    length: EXERCISE_ROW_HEIGHT,
    offset: paddingTop + (EXERCISE_ROW_HEIGHT + EXERCISE_ROW_GAP) * index,
    index,
  });
}

export function ExerciseRow({ item }: { item: ExerciseListItem }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <PressableScale
      onPress={() => router.push(`/exercise/${item.id}`)}
      style={[
        styles.row,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <Image
        source={mediaProvider.getThumbnail(item.id)}
        style={[styles.thumbnail, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        // The list recycles row views when the filter changes, and a recycled
        // <Image> keeps the previous exercise's bitmap — or renders blank —
        // unless the key tells it the source belongs to a different item.
        recyclingKey={item.id}
        transition={150}
        cachePolicy="memory-disk"
      />
      <ThemedView style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {item.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t(`muscles.${item.target}`)}
        </ThemedText>
      </ThemedView>
      <ThemedText type="small" style={{ color: theme.accent }}>
        ›
      </ThemedText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  row: {
    height: EXERCISE_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    paddingRight: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
  },
  rowText: { flex: 1, gap: Spacing.half, backgroundColor: 'transparent' },
});
