import { StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

let gradientId = 0;

/**
 * Fills its background with the brand accent gradient.
 *
 * React Native's `experimental_backgroundImage` is a no-op on web, so gradients
 * are painted with an SVG rect instead — that renders identically on native and
 * web. Callers must set `overflow: 'hidden'` alongside any `borderRadius` so the
 * rect is clipped to the rounded shape.
 */
export function GradientSurface({ style, children, ...rest }: ViewProps) {
  const theme = useTheme();
  // Gradient defs are document-global on web, so each instance needs its own id.
  const id = `accentGradient${gradientId++}`;

  return (
    <View style={style} {...rest}>
      <Svg style={StyleSheet.absoluteFill} width="100%" height="100%">
        <Defs>
          <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.accentAlt} />
            <Stop offset="1" stopColor={theme.accent} />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      {children}
    </View>
  );
}
