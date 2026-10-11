import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { useActionSheet } from '@/components/common/ActionSheet';
import { IconButton } from '@/components/common/IconButton';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { PostGrid } from '@/components/post/PostGrid';
import { spacing } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { COLLECTION_VISIBILITY, deleteCollection, fetchCollection } from '@/features/collections/api';
import { notifyCollectionsChanged, onCollectionsChanged } from '@/features/collections/events';
import { fetchCollectionPosts } from '@/features/posts/api';
import { usePagedList } from '@/hooks/usePagedList';
import type { Collection, FeedPost } from '@/types/database';
import { friendlyError } from '@/utils/errors';

export default function CollectionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const [collection, setCollection] = useState<Collection | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchCollection(id)
      .then(setCollection)
      .catch((e) => setError(friendlyError(e)));
  }, [id]);

  useEffect(load, [load]);

  const list = usePagedList<FeedPost>((previous) => fetchCollectionPosts(id, previous.at(-1)?.saved_at), [id]);
  useEffect(
    () =>
      onCollectionsChanged(() => {
        load();
        list.refresh();
      }),
    [load, list.refresh],
  );

  const mine = collection?.user_id === me.id;
  const showSheet = useActionSheet();

  const openMenu = () => {
    const remove = () =>
      Alert.alert('Koleksiyonu sil', 'Koleksiyon silinir; içindeki kombinler silinmez.', [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteCollection(id);
              notifyCollectionsChanged();
              router.back();
            } catch (e) {
              Alert.alert('Silinemedi', friendlyError(e));
            }
          },
        },
      ]);
    const edit = () => router.push({ pathname: '/collection/edit', params: { id } });
    showSheet({
      actions: [
        { label: 'Düzenle', run: edit },
        { label: 'Sil', destructive: true, run: remove },
      ],
    });
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (collection === undefined) return <LoadingState />;
  if (collection === null) {
    return <EmptyState icon="albums-outline" title="Koleksiyon bulunamadı" message="Silinmiş veya görüntüleme iznin yok." />;
  }

  const visibilityLabel = COLLECTION_VISIBILITY.find((v) => v.value === collection.visibility)?.label;

  return (
    <>
      <Stack.Screen
        options={{
          title: collection.name,
          headerRight: mine ? () => <IconButton name="ellipsis-horizontal" label="Seçenekler" onPress={openMenu} /> : undefined,
        }}
      />
      <PostGrid
        posts={list.items}
        refreshing={list.refreshing}
        onRefresh={list.refresh}
        onEndReached={list.loadMore}
        loadingMore={list.loadingMore}
        header={
          <View style={styles.header}>
            {collection.description ? <Text>{collection.description}</Text> : null}
            <Text variant="small" tone="secondary">
              {collection.post_count} kombin{mine ? ` · ${visibilityLabel}` : ''}
            </Text>
          </View>
        }
        empty={
          list.loading ? (
            <LoadingState />
          ) : (
            <EmptyState
              icon="albums-outline"
              title="Bu koleksiyon boş"
              message={mine ? 'Bir kombinin menüsünden “Koleksiyona ekle” ile kombin ekleyebilirsin.' : undefined}
            />
          )
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { padding: spacing.lg, gap: spacing.xs },
});
