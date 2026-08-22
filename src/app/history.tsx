import { inArray } from 'drizzle-orm';
import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuthSession, signOut, isSupabaseConfigured } from '@/auth';
import { Icon } from '@/components/icon';
import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardShadow, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { exercises, useCatalogDb, useWorkoutHistory } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

export default function HistoryScreen() {
  const { history, records, loading } = useWorkoutHistory();
  const catalogDb = useCatalogDb();
  const { session } = useAuthSession();
  const theme = useTheme();
  const { t, locale } = useTranslation();
  const [exerciseNames, setExerciseNames] = useState(new Map<string, string>());

  const recordIds = useMemo(
    () => Array.from(new Set(records.map((record) => record.exerciseId))),
    [records],
  );
  useEffect(() => {
    if (recordIds.length === 0) return;
    catalogDb
      .select({ id: exercises.id, name: exercises.name, nameEs: exercises.nameEs })
      .from(exercises)
      .where(inArray(exercises.id, recordIds))
      .then((rows) =>
        setExerciseNames(new Map(rows.map((row) => [row.id, row.nameEs ?? row.name]))),
      )
      .catch((err) => console.error('[history] catalog names failed', err));
  }, [catalogDb, recordIds]);

  const bestRecords = useMemo(() => {
    const best = new Map<string, (typeof records)[number]>();
    records.forEach((record) => {
      const key = `${record.exerciseId}:${record.type}:${record.contextWeightKg ?? ''}`;
      if (!best.has(key) || best.get(key)!.value < record.value) best.set(key, record);
    });
    return Array.from(best.values()).slice(0, 30);
  }, [records]);

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric' }),
    [locale],
  );

  return (
    <ThemedView style={styles.container}>
      <Stack.Screen options={{ title: t('history.title') }} />
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
        >
          <ThemedText type="subtitle">{t('history.title')}</ThemedText>
          <ThemedText themeColor="textSecondary">{t('history.subtitle')}</ThemedText>

          <ThemedView style={[styles.accountCard, { borderColor: theme.border }]}>
            <View style={styles.accountHeader}>
              <View style={styles.accountIcon}>
                <Icon name="dumbbell" size={18} color={theme.accent} />
              </View>
              <View style={styles.accountCopy}>
                <ThemedText type="sectionTitle">{t('account.title')}</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {!isSupabaseConfigured()
                    ? t('account.configureHint')
                    : (session?.user.email ?? t('account.localOnly'))}
                </ThemedText>
              </View>
            </View>
            {isSupabaseConfigured() && session ? (
              <PressableScale
                onPress={() =>
                  signOut().catch((err) => console.error('[auth] sign out failed', err))
                }
                accessibilityRole="button"
                style={[styles.outlineButton, { borderColor: theme.border }]}
              >
                <ThemedText type="smallBold" style={{ color: theme.accent }}>
                  {t('account.signOut')}
                </ThemedText>
              </PressableScale>
            ) : isSupabaseConfigured() ? (
              <PressableScale
                onPress={() => router.push('/auth' as never)}
                accessibilityRole="button"
                style={[styles.primaryButton, { backgroundColor: theme.accent }]}
              >
                <ThemedText type="smallBold" style={{ color: theme.onAccent }}>
                  {t('account.signIn')}
                </ThemedText>
              </PressableScale>
            ) : null}
          </ThemedView>

          <ThemedText type="sectionTitle" style={styles.sectionTitle}>
            {t('history.sessions')}
          </ThemedText>
          {loading ? (
            <ThemedText themeColor="textSecondary">{t('history.loading')}</ThemedText>
          ) : history.length === 0 ? (
            <ThemedText themeColor="textSecondary">{t('history.empty')}</ThemedText>
          ) : (
            history.map((item) => (
              <ThemedView key={item.id} style={[styles.rowCard, { borderColor: theme.border }]}>
                <View style={styles.rowHeader}>
                  <ThemedText type="sectionTitle">
                    {dateFormatter.format(new Date(item.startedAt))}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {item.totalVolumeKg ? `${Math.round(item.totalVolumeKg)} kg` : '—'}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {t('history.sets', { count: item.setCount })}
                </ThemedText>
              </ThemedView>
            ))
          )}

          <ThemedText type="sectionTitle" style={styles.sectionTitle}>
            {t('history.records')}
          </ThemedText>
          {bestRecords.length === 0 ? (
            <ThemedText themeColor="textSecondary">{t('history.recordsEmpty')}</ThemedText>
          ) : (
            bestRecords.map((record) => (
              <ThemedView key={record.id} style={[styles.rowCard, { borderColor: theme.border }]}>
                <View style={styles.rowHeader}>
                  <ThemedText type="sectionTitle" numberOfLines={1} style={styles.recordName}>
                    {exerciseNames.get(record.exerciseId) ?? record.exerciseId}
                  </ThemedText>
                  <ThemedText type="smallBold" style={{ color: theme.accent }}>
                    {formatRecord(record.value, record.type, record.contextWeightKg, t)}
                  </ThemedText>
                </View>
                <ThemedText type="small" themeColor="textSecondary">
                  {dateFormatter.format(new Date(record.achievedAt))}
                </ThemedText>
              </ThemedView>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function formatRecord(
  value: number,
  type: string,
  contextWeightKg: number | null,
  t: (key: string, options?: object) => string,
) {
  if (type === 'estimated_1rm')
    return `${Math.round(value * 10) / 10} kg · ${t('history.estimated1rm')}`;
  if (type === 'volume') return `${Math.round(value)} kg · ${t('history.volume')}`;
  return `${value} reps · ${contextWeightKg ?? 0} kg`;
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  content: { padding: Spacing.three, gap: Spacing.two },
  accountCard: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    ...CardShadow,
  },
  accountHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  accountIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountCopy: { flex: 1, gap: Spacing.half },
  outlineButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  primaryButton: {
    alignItems: 'center',
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
  },
  sectionTitle: { marginTop: Spacing.two },
  rowCard: {
    gap: Spacing.half,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  recordName: { flex: 1 },
});
