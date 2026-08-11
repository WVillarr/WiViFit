import { useMemo } from 'react';
import Body, { type ExtendedBodyPart } from 'react-native-body-highlighter';

import { useTheme } from '@/hooks/use-theme';

import { ALL_SLUGS, INERT_SLUGS, SLUG_TO_TARGET, TARGET_TO_SLUG } from './muscle-slugs';

export type MannequinView = 'front' | 'back';

/** The plate renders at 200x400 per unit of `scale` — see SvgMaleWrapper. */
export const BODY_MAP_BASE_WIDTH = 200;
export const BODY_MAP_BASE_HEIGHT = 400;

interface MuscleBodyMapProps {
  view: MannequinView;
  selectedMuscle: string | null;
  onSelectMuscle: (muscle: string) => void;
  scale?: number;
}

/**
 * Anatomy plate wrapping `react-native-body-highlighter`. Unselected muscles sit
 * in a muted tint of the brand accent, the selected one fills with the accent,
 * and head/hands/feet stay flat grey. The fat seam in the backdrop colour is
 * what carves the channel between neighbouring muscle bellies.
 *
 * Taps on regions the catalog has no exercises for (knees, ankles, tibialis) are
 * dropped by `SLUG_TO_TARGET` rather than disabled on the library, because its
 * `disabledParts` hardcodes a grey fill that ignores the theme.
 */
export function MuscleBodyMap({
  view,
  selectedMuscle,
  onSelectMuscle,
  scale = 1,
}: MuscleBodyMapProps) {
  const theme = useTheme();

  const data = useMemo<ExtendedBodyPart[]>(() => {
    const selected = selectedMuscle ? TARGET_TO_SLUG[selectedMuscle] : undefined;

    return ALL_SLUGS.map((slug) => ({
      slug,
      styles: {
        fill:
          slug === selected
            ? theme.accent
            : INERT_SLUGS.includes(slug)
              ? theme.bodyInert
              : theme.bodyMuted,
        stroke: theme.bodyLine,
        strokeWidth: 3,
      },
    }));
  }, [selectedMuscle, theme]);

  return (
    <Body
      data={data}
      side={view}
      gender="male"
      scale={scale}
      border={theme.bodyInert}
      onBodyPartPress={(part) => {
        const target = part.slug && SLUG_TO_TARGET[part.slug];
        if (target) onSelectMuscle(target);
      }}
    />
  );
}
