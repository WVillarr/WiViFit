import Svg, { Path } from 'react-native-svg';

import { Colors } from '@/constants/theme';

/** Geometry is authored in this box; `size` scales it. */
const VIEW_WIDTH = 100;
const VIEW_HEIGHT = 64;
const ASPECT = VIEW_HEIGHT / VIEW_WIDTH;

// A W drawn as one continuous zig-zag. Stroke width is 14, so every vertex sits
// at least 7 units inside the box and nothing gets clipped by the viewBox.
const DESCENDING = 'M7 7 L28 57 L50 22 L72 57';
const ASCENDING = 'M72 57 L93 7';

const STROKE_WIDTH = 14;

interface WivifitMarkProps {
  /** Width in points; height follows the mark's aspect ratio. */
  size?: number;
  /** Colour of the three leading strokes. */
  color?: string;
  /** Colour of the final rising stroke. */
  accent?: string;
}

/**
 * The WiviFit W.
 *
 * Split into two paths so the last leg carries the accent: the mark spends the
 * brand green on the one stroke that rises and holds it, which is the same rule
 * the rest of the UI follows (see Colors in constants/theme). Read as a chart,
 * it's two dips and a recovery — earned rather than decorative.
 *
 * Drawn rather than shipped as a PNG so it stays sharp at any size and can be
 * recoloured per surface; the native splash still needs a real raster asset.
 */
export function WivifitMark({
  size = 76,
  color = Colors.dark.text,
  accent = Colors.dark.accent,
}: WivifitMarkProps) {
  return (
    <Svg width={size} height={size * ASPECT} viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}>
      <Path
        d={DESCENDING}
        stroke={color}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <Path
        d={ASCENDING}
        stroke={accent}
        strokeWidth={STROKE_WIDTH}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Svg>
  );
}
