import type { ReactElement } from 'react';
import { FlatList, RefreshControl, useWindowDimensions } from 'react-native';

import { ItemCard } from '@/components/wardrobe/ItemCard';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { ResolvedItem } from '@/types/database';

const COLUMNS = 3;

export function WardrobeGrid({
  items,
  onPressItem,
  selectedIds,
  header,
  empty,
  refreshing,
  onRefresh,
}: {
  items: ResolvedItem[];
  onPressItem: (item: ResolvedItem) => void;
  selectedIds?: Set<string>;
  header?: ReactElement | null;
  empty?: ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cell = (width - spacing.lg * 2 - spacing.md * (COLUMNS - 1)) / COLUMNS;

  return (
    <FlatList
      data={items}
      numColumns={COLUMNS}
      keyExtractor={(i) => i.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={items.length > 0 ? { gap: spacing.md, paddingHorizontal: spacing.lg } : undefined}
      contentContainerStyle={{ gap: spacing.lg, paddingBottom: spacing.xxl, flexGrow: 1 }}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.textSecondary} />
        ) : undefined
      }
      renderItem={({ item }) => (
        <ItemCard
          item={item}
          width={cell}
          onPress={() => onPressItem(item)}
          selected={selectedIds ? selectedIds.has(item.id) : undefined}
        />
      )}
    />
  );
}
