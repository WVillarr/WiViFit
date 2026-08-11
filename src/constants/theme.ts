/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0B0D12',
    background: '#FFFFFF',
    backgroundElement: '#F2F4F7',
    backgroundSelected: '#E3E7EC',
    textSecondary: '#5A6472',
    border: '#E6E9EE',
    /** Energetic brand accent — pairs with `accentAlt` for gradients. */
    accent: '#FF4B26',
    accentAlt: '#FF9500',
    /** Tinted accent background for chips and highlights. */
    accentSoft: '#FFEDE7',
    onAccent: '#FFFFFF',
    /** Anatomy figure: lit surface, shadowed surface, muscle separation lines. */
    bodyLit: '#EDF1F6',
    bodyShade: '#B4C0CE',
    bodyLine: '#7D8B9C',
  },
  dark: {
    text: '#FFFFFF',
    background: '#08090B',
    backgroundElement: '#151719',
    backgroundSelected: '#212429',
    textSecondary: '#98A1AE',
    border: '#212429',
    accent: '#FF5B36',
    accentAlt: '#FFA51F',
    accentSoft: '#2A150F',
    onAccent: '#FFFFFF',
    bodyLit: '#454E5A',
    bodyShade: '#272E36',
    bodyLine: '#68737F',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
  },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

/** Corner radii. `pill` is the fully-rounded end cap used by chips and buttons. */
export const Radius = {
  sm: 10,
  md: 16,
  lg: 22,
  xl: 28,
  pill: 999,
} as const;

/** Soft elevation for cards. Spread into a style object. */
export const CardShadow = Platform.select({
  ios: {
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  android: { elevation: 3 },
  default: { boxShadow: '0 6px 20px rgba(0,0,0,0.08)' },
});

export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 800;
