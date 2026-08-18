import { router } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useRoutines, type RoutineRow } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

const DAYS_IN_WEEK = 7;

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
            onPress={() => router.push('/routine/new')}
            accessibilityRole="button"
            accessibilityLabel={t('routine.newTitle')}
            style={[styles.newButton, { backgroundColor: theme.accent }]}
          >
            <Icon name="plus" size={16} color={theme.onAccent} strokeWidth={2} />
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
              <View style={styles.emptyState}>
                <View style={[styles.emptyIconWrap, { backgroundColor: theme.accentSoft }]}>
                  <Icon name="dumbbell" size={28} color={theme.accent} strokeWidth={1.5} />
                </View>
                <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                  {t('routine.empty')}
                </ThemedText>
              </View>
            ) : null
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

/** Seven dots, filled left-to-right up to `daysPerWeek` — a shape read at a
 *  glance next to the exact count text, not a replacement for it. */
function DayDots({ daysPerWeek, color, trackColor }: { daysPerWeek: number; color: string; trackColor: string }) {
  return (
    <View style={styles.dayDots}>
      {Array.from({ length: DAYS_IN_WEEK }, (_, i) => (
        <View
          key={i}
          style={[styles.dayDot, { backgroundColor: i < daysPerWeek ? color : trackColor }]}
        />
      ))}
    </View>
  );
}

function RoutineCard({ routine }: { routine: RoutineRow }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <PressableScale
      onPress={() => router.push(`/routine/${routine.id}`)}
      scaleTo={0.98}
      accessibilityRole="button"
      style={[styles.card, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}
    >
      <View style={[styles.cardIconWrap, { backgroundColor: theme.accentSoft }]}>
        <Icon name="dumbbell" size={18} color={theme.accent} strokeWidth={1.6} />
      </View>
      <View style={styles.cardText}>
        <ThemedText type="smallBold">{routine.name}</ThemedText>
        <View style={styles.cardMetaRow}>
          <DayDots daysPerWeek={routine.daysPerWeek} color={theme.accent} trackColor={theme.border} />
          <ThemedText type="small" themeColor="textSecondary">
            {t('routine.daysPerWeek', { count: routine.daysPerWeek })}
          </ThemedText>
        </View>
      </View>
      <Icon name="chevron" size={16} color={theme.textSecondary} />
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
  },
  listContent: { padding: Spacing.three, gap: Spacing.two },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    ...CardShadow,
  },
  cardIconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardText: { flex: 1, gap: Spacing.half },
  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  dayDots: { flexDirection: 'row', gap: 3 },
  dayDot: { width: 6, height: 6, borderRadius: Radius.pill },
  emptyState: { alignItems: 'center', marginTop: Spacing.six, gap: Spacing.three, paddingHorizontal: Spacing.five },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: { textAlign: 'center' },
});
