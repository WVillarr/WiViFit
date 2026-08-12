import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

/** Press-in is quicker than the release, so a tap reads as answered rather than laggy. */
const PRESS_IN = { duration: 90, easing: Easing.out(Easing.quad) };
const PRESS_OUT = { duration: 190, easing: Easing.out(Easing.quad) };

export type PressableScaleProps = Omit<PressableProps, 'style'> & {
  /** Plain style only — the pressed state is animated, not re-rendered. */
  style?: StyleProp<ViewStyle>;
  /** How far the surface sinks under a finger. Big cards want less travel than chips. */
  scaleTo?: number;
  /** Opacity at full press. */
  dimTo?: number;
};

/**
 * Pressable whose press feedback runs on the UI thread.
 *
 * `Pressable`'s `style={({ pressed }) => …}` callback re-renders the subtree on
 * every press *and* release. On a list row that second render lands exactly as
 * the JS thread starts a navigation push, so the highlight shows up late, or
 * never. Driving scale and opacity from a shared value keeps the feedback on the
 * UI thread, where it holds frame rate no matter what JS is busy with.
 */
export function PressableScale({
  style,
  scaleTo = 0.97,
  dimTo = 0.9,
  onPressIn,
  onPressOut,
  ...rest
}: PressableScaleProps) {
  const progress = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - progress.value * (1 - scaleTo) }],
    opacity: 1 - progress.value * (1 - dimTo),
  }));

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(event) => {
        progress.value = withTiming(1, PRESS_IN);
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        progress.value = withTiming(0, PRESS_OUT);
        onPressOut?.(event);
      }}
      style={[style, animatedStyle]}
    />
  );
}
