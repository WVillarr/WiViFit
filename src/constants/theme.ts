/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

import '@/global.css';

import { Platform } from 'react-native';

/**
 * Navy field, emerald signal.
 *
 * The green is a *signal*, not a decoration: it marks the working muscle, the
 * selected state and the one primary action on a screen. Everything else is
 * navy and slate. Keeping it that scarce is what stops the UI reading as
 * neon — spend it anywhere else and the hierarchy collapses.
 *
 * `dark` is the designed palette; `light` re-derives the same identity for
 * daylight. Note `accent` differs between them on purpose: #00D084 is bright
 * enough to carry dark text (9.1:1) but only reaches 2:1 against white, so the
 * light theme drops to #00875A (4.6:1) to stay legible as text.
 */
export const Colors = {
  light: {
    text: '#0B132B',
    background: '#F4F6FA',
    backgroundElement: '#FFFFFF',
    backgroundSelected: '#E7EBF3',
    textSecondary: '#5C6883',
    border: '#DFE4EE',
    /** Brand accent — pairs with `accentAlt` for gradients. */
    accent: '#00875A',
    accentAlt: '#00B672',
    /** Tinted accent background for chips and highlights. */
    accentSoft: '#E1F7EE',
    onAccent: '#FFFFFF',
    /** Translucent `onAccent`, for a badge or divider sitting on an accent fill. */
    onAccentWash: 'rgba(255,255,255,0.24)',
    /**
     * Anatomy plate. `bodyBase` is the backdrop the muscle regions tile over,
     * `bodyMuted` an unselected muscle, `bodyInert` the parts that carry no
     * muscle (head, hands, feet) and `bodyLine` the seam between regions.
     * `bodyLine` matches `bodyBase` on purpose: the regions tile edge to edge,
     * so a fat seam in the backdrop colour is what carves the channel between
     * neighbouring muscles. The selected muscle is filled with `accent`.
     */
    bodyBase: '#FFFFFF',
    bodyMuted: '#BCC7DA',
    bodyInert: '#DDE3ED',
    bodyLine: '#FFFFFF',
  },
  dark: {
    text: '#FFFFFF',
    background: '#0B132B',
    backgroundElement: '#1C2541',
    backgroundSelected: '#243052',
    textSecondary: '#8D99AE',
    border: '#26325A',
    accent: '#00D084',
    accentAlt: '#00A86B',
    accentSoft: '#0D3B30',
    /** Dark ink on the bright green — 9.1:1, where white would sit at 2:1. */
    onAccent: '#0B132B',
    onAccentWash: 'rgba(11,19,43,0.18)',
    bodyBase: '#1C2541',
    // Tappable muscles read clearly against the card; head/hands/feet recede
    // near the border tone since they carry no action.
    bodyMuted: '#55699E',
    bodyInert: '#2C3760',
    bodyLine: '#1C2541',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

/** One resolved palette — what `useTheme()` hands back. */
export type Palette = { readonly [K in ThemeColor]: string };

/**
 * Archivo for display, IBM Plex Sans for everything you actually read.
 *
 * Archivo's sturdy, near-condensed grotesque gives headings weight without the
 * italic-varsity cliché; Plex was drawn as a systems typeface and matches the
 * technical-plate character of the exercise illustrations.
 *
 * One family per weight, deliberately: Android does not synthesise `fontWeight`
 * for custom fonts, so styles must name the exact face instead of asking for a
 * numeric weight. The root layout loads these before the splash lifts.
 */
export const FontFamily = {
  display: 'Archivo_700Bold',
  displaySemi: 'Archivo_600SemiBold',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemi: 'IBMPlexSans_600SemiBold',
  bodyBold: 'IBMPlexSans_700Bold',
} as const;

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
