import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/common/Text';
import { radius, spacing } from '@/constants/theme';
import { CATEGORY_LABELS } from '@/features/wardrobe/api';
import { useTheme } from '@/hooks/useTheme';
import type { ResolvedItem } from '@/types/database';

// Gardırop ızgarasındaki parça kartı. Seçim modunda işaret gösterir.
export function ItemCard({
  item,
  width,
  onPress,
  selected,
}: {
  item: ResolvedItem;
  width: number;
  onPress: () => void;
  selected?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{ width }}
      accessibilityRole={selected === undefined ? 'button' : 'checkbox'}
      accessibilityState={selected === undefined ? undefined : { checked: selected }}
      accessibilityLabel={`${item.name}, ${CATEGORY_LABELS[item.category]}`}
    >
      <View
        style={[
          styles.photo,
          { height: width * 1.25, backgroundColor: colors.stone, borderColor: selected ? colors.accent : 'transparent' },
        ]}
      >
        {item.thumbUrl ? (
          <Image
            source={{ uri: item.thumbUrl, cacheKey: item.thumb_path ?? undefined }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
            recyclingKey={item.id}
          />
        ) : (
          <Ionicons name="shirt-outline" size={28} color={colors.textSecondary} />
        )}
        {selected !== undefined ? (
          <View style={[styles.check, { backgroundColor: selected ? colors.accent : colors.overlay }]}>
            {selected ? <Ionicons name="checkmark" size={14} color={colors.onAccent} /> : null}
          </View>
        ) : null}
      </View>
      <Text variant="caption" numberOfLines={1} style={styles.name}>
        {item.name}
      </Text>
      <Text variant="small" tone="secondary" numberOfLines={1}>
        {[CATEGORY_LABELS[item.category], item.color].filter(Boolean).join(' · ')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  photo: {
    borderRadius: radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  check: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { marginTop: spacing.xs },
});
