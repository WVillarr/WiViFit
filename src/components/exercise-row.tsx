import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { ExerciseListItem } from '@/db';
import { useTranslation } from '@/i18n/use-translation';
import { mediaProvider } from '@/media';

export function ExerciseRow({ item }: { item: ExerciseListItem }) {
  const { t } = useTranslation();

  return (
    <Pressable
      onPress={() => router.push(`/exercise/${item.id}`)}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <Image source={mediaProvider.getThumbnail(item.id)} style={styles.thumbnail} contentFit="cover" />
      <ThemedView style={styles.rowText}>
        <ThemedText numberOfLines={1}>{item.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {t(`muscles.${item.target}`)}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.two,
  },
  rowPressed: { opacity: 0.6 },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: Spacing.two,
  },
  rowText: { flex: 1, gap: Spacing.half },
});
