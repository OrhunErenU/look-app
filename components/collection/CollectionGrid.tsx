import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactElement } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';

import { Text } from '@/components/common/Text';
import { radius, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Collection } from '@/types/database';

const VISIBILITY_ICON = {
  private: 'lock-closed-outline',
  followers: 'people-outline',
  public: 'globe-outline',
} as const;

export function CollectionCard({ collection, width }: { collection: Collection; width: number }) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={{ width }}
      onPress={() => router.push({ pathname: '/collection/[id]', params: { id: collection.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${collection.name} koleksiyonu, ${collection.post_count} kombin`}
    >
      <View style={[styles.cover, { height: width * 1.1, backgroundColor: colors.stone }]}>
        {collection.coverUrl ? (
          <Image
            source={{ uri: collection.coverUrl, cacheKey: collection.coverKey ?? undefined }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={150}
          />
        ) : (
          <Ionicons name="albums-outline" size={32} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.meta}>
        <Text variant="username" numberOfLines={1} style={styles.flex}>
          {collection.name}
        </Text>
        <Ionicons name={VISIBILITY_ICON[collection.visibility]} size={14} color={colors.textSecondary} />
      </View>
      <Text variant="small" tone="secondary">
        {collection.post_count} kombin
      </Text>
    </Pressable>
  );
}

export function CollectionGrid({
  collections,
  header,
  empty,
  refreshing,
  onRefresh,
}: {
  collections: Collection[];
  header?: ReactElement | null;
  empty?: ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cell = (width - spacing.lg * 2 - spacing.md) / 2;
  return (
    <FlatList
      data={collections}
      numColumns={2}
      keyExtractor={(c) => c.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={collections.length > 0 ? { gap: spacing.md, paddingHorizontal: spacing.lg } : undefined}
      contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.textSecondary} />
        ) : undefined
      }
      renderItem={({ item }) => <CollectionCard collection={item} width={cell} />}
    />
  );
}

const styles = StyleSheet.create({
  cover: { borderRadius: radius.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  flex: { flex: 1 },
});
