import { router, type Href } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useRoutines, type RoutineRow } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

export default function RoutinesScreen() {
  const { routines, loading } = useRoutines();
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.headerRow}>
          <ThemedText type="sectionTitle">{t('routine.listTitle')}</ThemedText>
          <PressableScale
            // `as Href`: same generated-types staleness as the dynamic route
            // cast below — .expo/types/router.d.ts hasn't been regenerated
            // since this route was added (regenerates on `expo start`).
            onPress={() => router.push('/routine/new' as Href)}
            accessibilityRole="button"
            accessibilityLabel={t('routine.newTitle')}
            style={[styles.newButton, { backgroundColor: theme.accent }]}
          >
            <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
              {t('routine.newButton')}
            </ThemedText>
          </PressableScale>
        </View>

        <FlatList
          data={routines}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item }) => <RoutineCard routine={item} />}
          ListEmptyComponent={
            !loading ? (
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {t('routine.empty')}
              </ThemedText>
            ) : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

function RoutineCard({ routine }: { routine: RoutineRow }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <PressableScale
      // `as Href`: typed-routes hasn't generated the templated `/routine/${string}`
      // form for this dynamic segment yet (a known gap for freshly-added
      // `[id]` routes — see routine/[id].tsx), not a real type error. The
      // route itself resolves fine at runtime regardless of this cast.
      onPress={() => router.push(`/routine/${routine.id}` as Href)}
      scaleTo={0.98}
      accessibilityRole="button"
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
    >
      <ThemedText type="smallBold">{routine.name}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {t('routine.daysPerWeek', { count: routine.daysPerWeek })}
      </ThemedText>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: Spacing.three,
    marginTop: Spacing.three,
  },
  newButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  listContent: { padding: Spacing.three, gap: Spacing.two },
  card: {
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  emptyText: { textAlign: 'center', marginTop: Spacing.five },
});
