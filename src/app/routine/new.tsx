import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PressableScale } from '@/components/pressable-scale';
import { RoutineDaysEditor, useRoutineDraft } from '@/components/routine-draft-editor';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { createRoutine, useUserDb } from '@/db';
import type { RoutineDraft } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

export default function NewRoutineScreen() {
  const userDb = useUserDb();
  const theme = useTheme();
  const { t } = useTranslation();
  const draft = useRoutineDraft('', []);
  const [saving, setSaving] = useState(false);

  const canSave = draft.name.trim().length > 0 && draft.days.some((d) => d.exercises.length > 0) && !saving;

  async function save() {
    if (!userDb || !canSave) return;
    setSaving(true);
    const routineDraft: RoutineDraft = { name: draft.name.trim(), days: draft.days };
    try {
      await createRoutine(userDb, routineDraft);
      router.replace('/routine');
    } catch (err) {
      console.error('[routine/new] save failed', err);
      setSaving(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <ThemedText type="sectionTitle" style={styles.title}>
            {t('routine.newTitle')}
          </ThemedText>

          <TextInput
            value={draft.name}
            onChangeText={draft.setName}
            placeholder={t('routine.namePlaceholder')}
            placeholderTextColor={theme.textSecondary}
            style={[
              styles.nameInput,
              { color: theme.text, backgroundColor: theme.backgroundElement, borderColor: theme.border },
            ]}
          />

          <RoutineDaysEditor
            days={draft.days}
            onRename={draft.renameDay}
            onRemoveDay={draft.removeDay}
            onAddExercise={draft.addExerciseTo}
            onRemoveExercise={draft.removeExercise}
            onUpdateExercise={draft.updateExercise}
            onAddDay={draft.addDay}
          />
        </ScrollView>

        <ThemedView style={[styles.saveBar, { borderTopColor: theme.border }]}>
          <PressableScale
            onPress={save}
            scaleTo={0.97}
            disabled={!canSave}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSave }}
            style={[styles.saveButton, { backgroundColor: canSave ? theme.accent : theme.backgroundSelected }]}
          >
            <ThemedText type="smallBold" style={{ color: canSave ? theme.onAccent : theme.textSecondary }}>
              {saving ? t('routine.saving') : t('routine.save')}
            </ThemedText>
          </PressableScale>
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center' },
  safeArea: { flex: 1, width: '100%', maxWidth: MaxContentWidth },
  scrollContent: { padding: Spacing.three, gap: Spacing.three, paddingBottom: Spacing.six },
  title: {},
  nameInput: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 16,
  },
  saveBar: {
    padding: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  saveButton: {
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.pill,
  },
});
