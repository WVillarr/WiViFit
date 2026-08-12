import { Archivo_600SemiBold, Archivo_700Bold } from '@expo-google-fonts/archivo';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  IBMPlexSans_700Bold,
} from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors, FontFamily, type Palette } from '@/constants/theme';
import { CATALOG_DB_NAME } from '@/db';

SplashScreen.preventAutoHideAsync();

const catalogDbAsset = require('../../assets/catalog.db');

/**
 * React Navigation paints the screen background and the native header itself,
 * so it needs the palette too — otherwise pushing the exercise detail flashes
 * the stock white/black card behind our navy.
 */
function navigationTheme(base: typeof DefaultTheme, palette: Palette) {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: palette.accent,
      background: palette.background,
      card: palette.background,
      text: palette.text,
      border: palette.border,
    },
  };
}

const LightNavigationTheme = navigationTheme(DefaultTheme, Colors.light);
const DarkNavigationTheme = navigationTheme(DarkTheme, Colors.dark);

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({
    Archivo_600SemiBold,
    Archivo_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexSans_700Bold,
  });

  // The splash is still up (auto-hide is blocked above), so this is a hold
  // rather than a blank frame — and it keeps the first paint from landing in
  // the system font and reflowing once Archivo arrives.
  if (!fontsLoaded) return null;

  const isDark = colorScheme === 'dark';

  return (
    <ThemeProvider value={isDark ? DarkNavigationTheme : LightNavigationTheme}>
      <SQLiteProvider databaseName={CATALOG_DB_NAME} assetSource={{ assetId: catalogDbAsset }}>
        <AnimatedSplashOverlay />
        <Stack
          screenOptions={{
            headerTitleStyle: { fontFamily: FontFamily.bodySemi },
            contentStyle: {
              backgroundColor: isDark ? Colors.dark.background : Colors.light.background,
            },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
