import { eq } from 'drizzle-orm';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExerciseRow } from '@/components/exercise-row';
import { MannequinView, MuscleBodyMap } from '@/components/muscle-body-map';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, Spacing } from '@/constants/theme';
import { exercises, ExerciseRow as ExerciseRowData, useCatalogDb } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

const CARDIO_MUSCLE = 'cardiovascular_system';

export default function BodyScreen() {
  const db = useCatalogDb();
  const theme = useTheme();
  const { t } = useTranslation();

  const [mannequinView, setMannequinView] = useState<MannequinView>('front');
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [results, setResults] = useState<ExerciseRowData[]>([]);

  useEffect(() => {
    if (!selectedMuscle) {
      setResults([]);
      return;
    }

    let cancelled = false;

    db.select()
      .from(exercises)
      .where(eq(exercises.target, selectedMuscle))
      .limit(200)
      .then((rows) => {
        if (!cancelled) setResults(rows);
      })
      .catch((err) => {
        console.error('[body] query failed', err);
      });

    return () => {
      cancelled = true;
    };
  }, [db, selectedMuscle]);

  function selectMuscle(muscle: string) {
    setSelectedMuscle((current) => (current === muscle ? null : muscle));
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <ThemedText type="subtitle" numberOfLines={1} style={styles.headerTitle}>
            {selectedMuscle ? t(`muscles.${selectedMuscle}`) : t('body.title')}
          </ThemedText>
          <Pressable
            onPress={() => setMannequinView((v) => (v === 'front' ? 'back' : 'front'))}
            style={[styles.flipButton, { backgroundColor: theme.backgroundElement }]}
          >
            <ThemedText type="small">
              {mannequinView === 'front' ? t('body.viewBack') : t('body.viewFront')}
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.mannequinWrap}>
          <MuscleBodyMap
            view={mannequinView}
            selectedMuscle={selectedMuscle}
            onSelectMuscle={selectMuscle}
          />
        </View>

        <Pressable
          onPress={() => selectMuscle(CARDIO_MUSCLE)}
          style={[
            styles.cardioChip,
            {
              backgroundColor:
                selectedMuscle === CARDIO_MUSCLE ? theme.backgroundSelected : theme.backgroundElement,
            },
          ]}
        >
          <ThemedText type="small">{t(`muscles.${CARDIO_MUSCLE}`)}</ThemedText>
        </Pressable>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <ExerciseRow item={item} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            selectedMuscle ? (
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {t('exercises.noResults')}
              </ThemedText>
            ) : (
              <ThemedText themeColor="textSecondary" style={styles.emptyText}>
                {t('body.prompt')}
              </ThemedText>
            )
          }
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
  },
  headerTitle: { flexShrink: 1 },
  flipButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
  },
  mannequinWrap: {
    height: 280,
    aspectRatio: 220 / 440,
    alignSelf: 'center',
    marginTop: Spacing.two,
  },
  cardioChip: {
    alignSelf: 'center',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    borderRadius: Spacing.four,
    marginTop: Spacing.two,
  },
  listContent: {
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.four,
    gap: Spacing.one,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: Spacing.four,
  },
});
