import { Platform, StyleSheet, Text, type TextProps } from 'react-native';

import { FontFamily, Fonts, ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?:
    | 'default'
    | 'title'
    | 'small'
    | 'smallBold'
    | 'subtitle'
    | 'sectionTitle'
    | 'eyebrow'
    | 'link'
    | 'linkPrimary'
    | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();

  return (
    <Text
      style={[
        { color: theme[themeColor ?? 'text'] },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'sectionTitle' && styles.sectionTitle,
        type === 'eyebrow' && styles.eyebrow,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

// Weight lives in `fontFamily`, never `fontWeight` — see FontFamily in theme.ts.
const styles = StyleSheet.create({
  small: {
    fontFamily: FontFamily.bodyMedium,
    fontSize: 14,
    lineHeight: 20,
  },
  smallBold: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 14,
    lineHeight: 20,
  },
  default: {
    fontFamily: FontFamily.body,
    fontSize: 16,
    lineHeight: 24,
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.8,
  },
  subtitle: {
    fontFamily: FontFamily.display,
    fontSize: 27,
    lineHeight: 33,
    letterSpacing: -0.5,
  },
  /** Row and card headings — the step below `subtitle`. */
  sectionTitle: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 17,
    lineHeight: 23,
    letterSpacing: -0.1,
  },
  /** Small caps-style annotation above a section. Caller supplies the casing. */
  eyebrow: {
    fontFamily: FontFamily.bodySemi,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 1.6,
  },
  link: {
    fontFamily: FontFamily.bodyMedium,
    lineHeight: 30,
    fontSize: 14,
  },
  linkPrimary: {
    fontFamily: FontFamily.bodyMedium,
    lineHeight: 30,
    fontSize: 14,
    color: '#3c87f7',
  },
  code: {
    fontFamily: Fonts.mono,
    fontWeight: Platform.select({ android: 700 }) ?? 500,
    fontSize: 12,
  },
});
