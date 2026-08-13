import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/pressable-scale';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';

/**
 * A failed query used to be silent — `console.error` and an empty list a user
 * can't tell apart from "no results". This gives it a message and a retry
 * instead of a red banner: the accent colour is reserved for the one primary
 * action per screen (see theme.ts), so this borrows the same neutral palette
 * as everything else and lets the wording carry the urgency.
 */
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.container}>
      <ThemedText themeColor="textSecondary" style={styles.message}>
        {t('common.errorMessage')}
      </ThemedText>
      <PressableScale
        onPress={onRetry}
        scaleTo={0.96}
        accessibilityRole="button"
        accessibilityLabel={t('common.retry')}
        style={[styles.button, { borderColor: theme.border }]}
      >
        <ThemedText type="smallBold" style={{ color: theme.accent }}>
          {t('common.retry')}
        </ThemedText>
      </PressableScale>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.four,
    paddingHorizontal: Spacing.three,
  },
  message: { textAlign: 'center' },
  button: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
