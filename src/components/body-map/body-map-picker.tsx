import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

import { BodyMapPager } from './body-map-pager';

interface BodyMapPickerProps {
  /** The muscle the results list is currently filtered by. */
  selectedMuscle: string | null;
  onSelectMuscle: (muscle: string | null) => void;
  /** Exercise count per `target`, for the caption. */
  counts: Record<string, number>;
}

/**
 * The anatomy plate as a two-step picker.
 *
 * The first tap lights a region and names it; only the second one filters. The
 * pause is the point: almost nobody knows the muscle they want is called the
 * latissimus dorsi, and a map that jumps straight to results never gets the
 * chance to tell them. The caption is where the app teaches the word.
 *
 * `preview` is what's lit, and it's deliberately separate from `selectedMuscle`
 * — you can read your way around the body without disturbing the list.
 */
export function BodyMapPicker({ selectedMuscle, onSelectMuscle, counts }: BodyMapPickerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(selectedMuscle);

  const lit = preview ?? selectedMuscle;
  const confirmed = lit != null && selectedMuscle === lit;

  function onRegionPress(muscle: string) {
    if (muscle !== lit) {
      // First tap only names it. Moving to a new region drops the old filter,
      // so the list never disagrees with the region that's lit.
      setPreview(muscle);
      if (selectedMuscle) onSelectMuscle(null);
      return;
    }
    if (confirmed) {
      setPreview(null);
      onSelectMuscle(null);
    } else {
      onSelectMuscle(muscle);
    }
  }

  return (
    <View style={styles.container}>
      <BodyMapPager selectedMuscle={lit} onSelectMuscle={onRegionPress} />

      <View
        style={[styles.caption, { backgroundColor: theme.background, borderColor: theme.border }]}
        accessibilityLiveRegion="polite"
      >
        {lit ? (
          <>
            <ThemedText type="sectionTitle" numberOfLines={1}>
              {t(`muscles.${lit}`)}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('exercises.resultsCount', { count: counts[lit] ?? 0 })}
            </ThemedText>
            <ThemedText
              type="smallBold"
              style={{ color: confirmed ? theme.textSecondary : theme.accent }}
            >
              {t(confirmed ? 'exercises.bodyMapShowing' : 'exercises.bodyMapConfirm')}
            </ThemedText>
          </>
        ) : (
          <ThemedText type="small" themeColor="textSecondary" style={styles.prompt}>
            {t('exercises.bodyMapPrompt')}
          </ThemedText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%', alignItems: 'center', gap: Spacing.three },
  caption: {
    // Reserves the three-line height up front so committing a muscle doesn't
    // shift the plate above it.
    minHeight: 74,
    alignSelf: 'stretch',
    marginHorizontal: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    justifyContent: 'center',
    gap: Spacing.half,
  },
  prompt: { textAlign: 'center' },
});
