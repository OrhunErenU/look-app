import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Text } from '@/components/common/Text';
import { radius, spacing } from '@/constants/theme';
import { CATEGORY_LABELS } from '@/features/wardrobe/api';
import { useTheme } from '@/hooks/useTheme';
import type { WardrobeCategory } from '@/types/database';

type StripItem = {
  id: string;
  name: string;
  category: WardrobeCategory;
  brand?: string | null;
  thumbUrl: string | null;
  thumb_path: string | null;
};

// Bir kombinde kullanılan parçaların yatay listesi.
export function ItemStrip({ items }: { items: StripItem[] }) {
  const { colors } = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {items.map((item) => (
        <View key={item.id} style={styles.item} accessible accessibilityLabel={`${CATEGORY_LABELS[item.category]}: ${item.name}`}>
          <View style={[styles.photo, { backgroundColor: colors.stone }]}>
            {item.thumbUrl ? (
              <Image
                source={{ uri: item.thumbUrl, cacheKey: item.thumb_path ?? undefined }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
            ) : (
              <Ionicons name="shirt-outline" size={24} color={colors.textSecondary} />
            )}
          </View>
          <Text variant="small" tone="secondary" numberOfLines={1}>
            {CATEGORY_LABELS[item.category]}
          </Text>
          <Text variant="caption" numberOfLines={2}>
            {item.name}
            {item.brand ? ` · ${item.brand}` : ''}
          </Text>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.md },
  item: { width: 96, gap: 2 },
  photo: {
    width: 96,
    height: 120,
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
});
