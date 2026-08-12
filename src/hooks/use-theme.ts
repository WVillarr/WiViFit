/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export function useTheme() {
  const scheme = useColorScheme();
  // Dark is the designed palette, so it wins when the platform has no opinion.
  const theme = scheme === 'unspecified' ? 'dark' : scheme;

  return Colors[theme];
}
