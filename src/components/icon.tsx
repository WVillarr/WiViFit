import Svg, { Circle, Path, Rect } from 'react-native-svg';

export type IconName =
  | 'chevron'
  | 'plus'
  | 'close'
  | 'check'
  | 'dumbbell'
  | 'clock'
  | 'route'
  | 'flame'
  | 'pencil'
  | 'trash'
  | 'play';

/**
 * Hand-drawn glyph set, not a vector-icon package — every other custom SVG in
 * the app (GradientSurface, the anatomy plate) is drawn to match the
 * Archivo/Plex "technical-plate" character described in theme.ts, and pulling
 * in a generic icon font would read as a different hand mid-app. Purely
 * decorative: wrap in a Pressable that already carries its own
 * accessibilityLabel, never give the icon itself a role.
 */
export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 1.75,
}: {
  name: IconName;
  size?: number;
  color: string;
  strokeWidth?: number;
}) {
  const stroke = { stroke: color, strokeWidth, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' };

  switch (name) {
    case 'chevron':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M9 5l7 7-7 7" {...stroke} />
        </Svg>
      );
    case 'plus':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M12 5v14M5 12h14" {...stroke} />
        </Svg>
      );
    case 'close':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M6 6l12 12M18 6L6 18" {...stroke} />
        </Svg>
      );
    case 'check':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M5 13l4.5 4.5L19 7" {...stroke} />
        </Svg>
      );
    case 'dumbbell':
      // Filled, like `flame` and `play`, rather than the five thin strokes
      // the other utility glyphs use: as an outline at the 15–18px this
      // renders at, the plates and the bar collapse into evenly-spaced
      // verticals and the whole thing reads as a letter H. Solid plates keep
      // the silhouette. Bar and plates are sized to carry about the same
      // visual weight as a 1.75 stroke so it still sits next to `clock` and
      // `route` in a routine's exercise list without shouting.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Rect x="2" y="10" width="2" height="4" rx="0.9" fill={color} />
          <Rect x="5" y="7" width="3" height="10" rx="1.3" fill={color} />
          <Rect x="8" y="10.75" width="8" height="2.5" fill={color} />
          <Rect x="16" y="7" width="3" height="10" rx="1.3" fill={color} />
          <Rect x="20" y="10" width="2" height="4" rx="0.9" fill={color} />
        </Svg>
      );
    case 'clock':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={12} cy={12} r={8.5} {...stroke} />
          <Path d="M12 7.5V12l3.2 2.2" {...stroke} />
        </Svg>
      );
    case 'route':
      // Start/end dots joined by a dashed line — distance tracking, not a
      // literal map, so it stays legible at 16-20px.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Circle cx={5} cy={19} r={1.6} fill={color} />
          <Path d="M7.3 17C10.5 12.7 14 8.3 17.3 5" {...stroke} strokeDasharray="1.5 3.5" />
          <Circle cx={19} cy={5} r={1.6} fill={color} />
        </Svg>
      );
    case 'flame':
      // Filled, unlike the stroked utility icons around it — this marks the
      // PR moment, and a solid mass reads warmer at 16px than an outline of
      // the same shape would. One outer teardrop plus a punched-out inner
      // tongue (evenodd), rather than two overlapping curves, so the hollow
      // survives being scaled down.
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path
            d="M12 2.2c3 3.4 5.6 6 5.6 9.6a5.6 5.6 0 11-11.2 0c0-2 .9-3.7 2.2-5.2 0 1.6.5 2.7 1.5 3 .6-2.9 1-5 1.9-7.4zm0 8.9c-1.2 1.5-2 2.6-2 3.9a2 2 0 104 0c0-1.3-.8-2.4-2-3.9z"
            fill={color}
            fillRule="evenodd"
          />
        </Svg>
      );
    case 'pencil':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M14.2 5.3l4.5 4.5L8.4 20H4v-4.4L14.2 5.3z" {...stroke} />
        </Svg>
      );
    case 'trash':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M4.5 7h15M9.5 7V4.5h5V7M7 7l.9 12.5h8.2L17 7" {...stroke} />
        </Svg>
      );
    case 'play':
      return (
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Path d="M7.5 5.2v13.6L18.5 12 7.5 5.2z" fill={color} />
        </Svg>
      );
  }
}
