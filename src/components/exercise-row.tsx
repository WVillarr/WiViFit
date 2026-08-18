import { Image } from 'expo-image';
import { router } from 'expo-router';
import { PixelRatio, StyleSheet } from 'react-native';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { exerciseName, ExerciseListItem } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';
import { mediaProvider } from '@/media';

/**
 * Fixed so every row is the same height whether or not the name wraps to a
 * second line. Uniform rows are what let a list hand VirtualizedList exact
 * offsets instead of measuring each cell — see `exerciseRowLayout`.
 *
 * 62 = the tallest content at the OS default font scale (two 20pt name lines
 * + 2 gap + a 20pt subtitle). Text scales with the system's accessibility
 * font size (RN's default `allowFontScaling`), so a fixed 78 clipped the
 * second name line under a large-text setting; scaling this by the same
 * factor keeps the row exactly as tall as the text it holds. The vertical
 * padding (`Spacing.two` top and bottom) doesn't scale — it's layout
 * breathing room, not text.
 */
const BASE_CONTENT_HEIGHT = 62;
const ROW_VERTICAL_PADDING = Spacing.two * 2;
export const EXERCISE_ROW_HEIGHT = Math.round(
  BASE_CONTENT_HEIGHT * Math.max(1, PixelRatio.getFontScale()) + ROW_VERTICAL_PADDING,
);

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

export function ExerciseRow({
  item,
  onPress,
}: {
  item: ExerciseListItem;
  /** Defaults to pushing the detail screen — the routine-builder's picker
   *  (routine/pick-exercise.tsx) overrides this to add the exercise instead. */
  onPress?: () => void;
}) {
  const { t, locale } = useTranslation();
  const theme = useTheme();

  const name = exerciseName(item, locale);
  return (
    <PressableScale
      onPress={onPress ?? (() => router.push(`/exercise/${item.id}`))}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${t(`muscles.${item.target}`)}`}
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
          {name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t(`muscles.${item.target}`)}
        </ThemedText>
      </ThemedView>
      <Icon name="chevron" size={16} color={theme.textSecondary} />
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
