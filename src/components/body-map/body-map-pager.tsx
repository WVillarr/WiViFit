import { useRef, useState } from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

import { BODY_MAP_BASE_HEIGHT, MannequinView, MuscleBodyMap } from './muscle-body-map';

const VIEWS: MannequinView[] = ['front', 'back'];

interface BodyMapPagerProps {
  selectedMuscle: string | null;
  onSelectMuscle: (muscle: string) => void;
  /** Height of the figure; the width follows from the plate's aspect ratio. */
  height?: number;
}

/**
 * Front and back plates on a swipeable pager, with dots doubling as the
 * shortcut for jumping straight to the other side.
 */
export function BodyMapPager({ selectedMuscle, onSelectMuscle, height = 300 }: BodyMapPagerProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const scroller = useRef<ScrollView>(null);
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);

  function onScrollEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    if (pageWidth === 0) return;
    setPage(Math.round(event.nativeEvent.contentOffset.x / pageWidth));
  }

  function goTo(index: number) {
    setPage(index);
    scroller.current?.scrollTo({ x: index * pageWidth, animated: true });
  }

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}
        onMomentumScrollEnd={onScrollEnd}
        style={{ height }}
      >
        {/* Pages render before the first layout pass; until `pageWidth` is
            known they size to the figure, which still scrolls — gating the
            render on the measurement instead leaves the card empty on web,
            where onLayout doesn't always fire for a percentage-width view. */}
        {VIEWS.map((view) => (
          <View key={view} style={[styles.page, { width: pageWidth || undefined, height }]}>
            <MuscleBodyMap
              view={view}
              selectedMuscle={selectedMuscle}
              onSelectMuscle={onSelectMuscle}
              scale={height / BODY_MAP_BASE_HEIGHT}
            />
          </View>
        ))}
      </ScrollView>

      <View style={styles.dots}>
        {VIEWS.map((view, index) => (
          <Pressable
            key={view}
            onPress={() => goTo(index)}
            hitSlop={Spacing.two}
            accessibilityRole="button"
            accessibilityState={{ selected: page === index }}
            accessibilityLabel={t(view === 'front' ? 'exercises.viewFront' : 'exercises.viewBack')}
            style={[
              styles.dot,
              page === index
                ? { width: 22, backgroundColor: theme.accent }
                : { backgroundColor: theme.border },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: '100%' },
  page: { alignItems: 'center', justifyContent: 'center' },
  dots: {
    flexDirection: 'row',
    alignSelf: 'center',
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  dot: { width: 8, height: 8, borderRadius: Radius.pill },
});
