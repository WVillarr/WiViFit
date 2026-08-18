import { type ReactNode, useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Circle, Svg } from 'react-native-svg';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * Circular progress indicator — the app's one signature motion piece, used by
 * the rest timer in workout mode. `progress` is 0-1 fraction *remaining*, so
 * 1 is a full ring and it drains to 0. Re-tweens toward the new value in
 * 300ms (a touch longer than the 250ms tick that drives it in
 * useRestCountdown) rather than snapping, so a discrete per-second update
 * still reads as continuous motion.
 */
export function ProgressRing({
  size,
  strokeWidth = 8,
  progress,
  color,
  trackColor,
  children,
}: {
  size: number;
  strokeWidth?: number;
  progress: number;
  color: string;
  trackColor: string;
  children?: ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animatedProgress = useSharedValue(progress);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 300, easing: Easing.linear });
  }, [animatedProgress, progress]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animatedProgress.value),
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} style={styles.svg}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          animatedProps={animatedProps}
          // Starts the sweep at 12 o'clock instead of SVG's default 3 o'clock.
          rotation={-90}
          origin={`${size / 2}, ${size / 2}`}
        />
      </Svg>
      {children != null && <View style={styles.content}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  svg: { position: 'absolute' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
