import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Radius, Spacing } from '@/constants/theme';
import { ExerciseListItem } from '@/db';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/i18n/use-translation';
import { mediaProvider } from '@/media';

export function ExerciseRow({ item }: { item: ExerciseListItem }) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Pressable
      onPress={() => router.push(`/exercise/${item.id}`)}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.rowPressed,
      ]}
    >
      <Image
        source={mediaProvider.getThumbnail(item.id)}
        style={styles.thumbnail}
        contentFit="cover"
      />
      <ThemedView style={styles.rowText}>
        <ThemedText type="smallBold" numberOfLines={2}>
          {item.name}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t(`muscles.${item.target}`)}
        </ThemedText>
      </ThemedView>
      <ThemedText type="small" style={{ color: theme.accent }}>
        ›
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    paddingRight: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowPressed: { opacity: 0.7 },
  thumbnail: {
    width: 56,
    height: 56,
    borderRadius: Radius.sm,
  },
  rowText: { flex: 1, gap: Spacing.half, backgroundColor: 'transparent' },
});
