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
import { enableFreeze } from 'react-native-screens';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors, FontFamily, type Palette } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/auth';
import { CATALOG_DB_NAME } from '@/db';
import { useSyncOnReconnect } from '@/sync';

SplashScreen.preventAutoHideAsync();

// Off by default in react-native-screens. Without it the two tabs you aren't
// looking at keep re-rendering behind the one you are — including Home's
// looping CTA pulse — and so does the list underneath a pushed exercise.
enableFreeze(true);

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

/**
 * Mounted once here rather than called directly in RootLayout: the hook
 * needs `useUserDb()`, which only resolves once `user.db` has opened, and
 * keeping it in its own leaf component means that resolution can't be
 * blamed for a re-render anywhere else in the tree.
 */
function SyncBootstrap() {
  const { configured, session } = useAuth();
  useSyncOnReconnect(configured && Boolean(session));
  return null;
}

function Navigation() {
  const { configured, loading, session } = useAuth();
  const colorScheme = useColorScheme();

  if (loading) return null;
  if (configured && !session) {
    return (
      <Stack>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack>
    );
  }

  return (
    <>
      <SyncBootstrap />
      <AnimatedSplashOverlay />
      <Stack
        screenOptions={{
          headerTitleStyle: { fontFamily: FontFamily.bodySemi },
          contentStyle: {
            backgroundColor:
              colorScheme === 'dark' ? Colors.dark.background : Colors.light.background,
          },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
        <Stack.Screen name="routine/index" options={{ title: '' }} />
        <Stack.Screen name="routine/new" options={{ title: '' }} />
        <Stack.Screen name="routine/[id]" options={{ title: '' }} />
        <Stack.Screen name="routine/pick-exercise" options={{ title: '', presentation: 'modal' }} />
        <Stack.Screen name="workout/[sessionId]" options={{ title: '', gestureEnabled: false }} />
      </Stack>
    </>
  );
}

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
        <AuthProvider>
          <Navigation />
        </AuthProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
