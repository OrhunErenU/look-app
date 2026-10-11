import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { collectionsContaining, fetchCollections, setInCollection } from '@/features/collections/api';
import { notifyCollectionsChanged, onCollectionsChanged } from '@/features/collections/events';
import { useTheme } from '@/hooks/useTheme';
import type { Collection } from '@/types/database';
import { friendlyError } from '@/utils/errors';

// Bir kombini kullanıcının koleksiyonlarına ekleme veya çıkarma. Aynı kombin
// birden fazla koleksiyonda bulunabilir.
export default function AddToCollection() {
  const { postId } = useLocalSearchParams<{ postId: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [included, setIncluded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [all, current] = await Promise.all([fetchCollections(me.id), collectionsContaining(postId)]);
      setCollections(all);
      setIncluded(current);
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [me.id, postId]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => onCollectionsChanged(load), [load]);

  const toggle = async (collection: Collection) => {
    const next = !included.has(collection.id);
    setIncluded((prev) => {
      const copy = new Set(prev);
      if (next) copy.add(collection.id);
      else copy.delete(collection.id);
      return copy;
    });
    try {
      await setInCollection(collection.id, postId, next);
      notifyCollectionsChanged();
    } catch (e) {
      setIncluded((prev) => {
        const copy = new Set(prev);
        if (next) copy.delete(collection.id);
        else copy.add(collection.id);
        return copy;
      });
      Alert.alert('İşlem tamamlanamadı', friendlyError(e));
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (collections === null) return <LoadingState />;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <FlatList
        data={collections}
        keyExtractor={(c) => c.id}
        contentContainerStyle={{ flexGrow: 1 }}
        renderItem={({ item }) => {
          const checked = included.has(item.id);
          return (
            <Pressable
              style={[styles.row, { borderBottomColor: colors.border }]}
              onPress={() => toggle(item)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              <View style={styles.flex}>
                <Text variant="username">{item.name}</Text>
                <Text variant="small" tone="secondary">
                  {item.post_count} kombin
                </Text>
              </View>
              <Ionicons
                name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                size={24}
                color={checked ? colors.accent : colors.textSecondary}
              />
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <EmptyState icon="albums-outline" title="Henüz koleksiyonun yok" message="Yeni bir koleksiyon oluşturup bu kombini ekle." />
        }
      />
      <View style={styles.footer}>
        <Button
          title="Yeni koleksiyon"
          icon="add"
          variant="secondary"
          onPress={() => router.push({ pathname: '/collection/edit', params: { addPostId: postId } })}
        />
        <Button title="Bitti" onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 60,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  footer: { padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
});
