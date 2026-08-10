import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { CATALOG_DB_NAME } from '@/db';

SplashScreen.preventAutoHideAsync();

const catalogDbAsset = require('../../assets/catalog.db');

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SQLiteProvider databaseName={CATALOG_DB_NAME} assetSource={{ assetId: catalogDbAsset }}>
        <AnimatedSplashOverlay />
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="exercise/[id]" options={{ title: '' }} />
        </Stack>
      </SQLiteProvider>
    </ThemeProvider>
  );
}
