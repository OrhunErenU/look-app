import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { WardrobeGrid } from '@/components/wardrobe/WardrobeGrid';
import { spacing } from '@/constants/theme';
import { CATEGORIES, fetchWardrobe } from '@/features/wardrobe/api';
import { onWardrobeChanged } from '@/features/wardrobe/events';
import { finishPicking, getPickedItems } from '@/features/wardrobe/selection';
import { useTheme } from '@/hooks/useTheme';
import type { ResolvedItem, WardrobeCategory } from '@/types/database';
import { friendlyError } from '@/utils/errors';

const MAX_ITEMS = 20;

// Kombine eklenecek gardırop parçalarını seçme ekranı.
export default function PickItems() {
  const { colors } = useTheme();
  const [items, setItems] = useState<ResolvedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<WardrobeCategory | null>(null);
  const [selected, setSelected] = useState<string[]>(getPickedItems());

  const load = useCallback(() => {
    setError(null);
    fetchWardrobe({ category })
      .then(setItems)
      .catch((e) => setError(friendlyError(e)));
  }, [category]);

  useEffect(load, [load]);
  // Boş gardıroptan parça eklenip dönüldüğünde liste yenilenir.
  useEffect(() => onWardrobeChanged(load), [load]);

  const toggle = (item: ResolvedItem) =>
    setSelected((prev) =>
      prev.includes(item.id) ? prev.filter((id) => id !== item.id) : prev.length < MAX_ITEMS ? [...prev, item.id] : prev,
    );

  const done = () => {
    finishPicking(selected);
    router.back();
  };

  const filters = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      <Chip label="Tümü" selected={category === null} onPress={() => setCategory(null)} />
      {CATEGORIES.map((c) => (
        <Chip key={c.value} label={c.label} selected={category === c.value} onPress={() => setCategory(c.value)} />
      ))}
    </ScrollView>
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : items === null ? (
        <LoadingState />
      ) : (
        <WardrobeGrid
          items={items}
          selectedIds={new Set(selected)}
          onPressItem={toggle}
          header={filters}
          empty={
            <EmptyState
              icon="shirt-outline"
              title="Gardırobun boş"
              message="Önce gardırobuna birkaç parça ekle, sonra onlardan kombin oluştur."
              actionTitle="Parça ekle"
              onAction={() => router.push({ pathname: '/wardrobe/item/[id]', params: { id: 'new' } })}
            />
          }
        />
      )}
      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.background }]}>
        <Text variant="caption" tone="secondary" style={styles.flex}>
          {selected.length} parça seçildi
        </Text>
        <Button title="Tamam" onPress={done} compact />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
