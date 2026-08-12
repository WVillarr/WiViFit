import { useId, useState } from 'react';
import { LayoutChangeEvent, StyleSheet, View, type ViewProps } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

/**
 * Fills its background with the brand accent gradient.
 *
 * React Native's `experimental_backgroundImage` is a no-op on web, so gradients
 * are painted with an SVG rect instead — that renders identically on native and
 * web. Callers must set `overflow: 'hidden'` alongside any `borderRadius` so the
 * rect is clipped to the rounded shape.
 *
 * The surface is measured rather than sized with `width="100%"`: a percentage on
 * an absolutely-positioned <Svg> resolves against the wrong box on native and
 * leaves the gradient covering only part of the card.
 */
export function GradientSurface({ style, children, onLayout, ...rest }: ViewProps) {
  const theme = useTheme();
  const [size, setSize] = useState({ width: 0, height: 0 });
  // Gradient defs are document-global on web, so each instance needs its own
  // stable id. useId's separators aren't valid in a url(#…) reference, so they
  // are stripped.
  const id = `accentGradient${useId().replace(/[^a-zA-Z0-9]/g, '')}`;

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    );
    onLayout?.(event);
  }

  return (
    <View style={style} onLayout={handleLayout} {...rest}>
      {size.width > 0 && size.height > 0 && (
        <Svg style={StyleSheet.absoluteFill} width={size.width} height={size.height}>
          <Defs>
            <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={theme.accentAlt} />
              <Stop offset="1" stopColor={theme.accent} />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width={size.width} height={size.height} fill={`url(#${id})`} />
        </Svg>
      )}
      {children}
    </View>
  );
}
