import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/common/Chip';
import { IconButton } from '@/components/common/IconButton';
import { Segmented } from '@/components/common/Segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { TopBar } from '@/components/common/TopBar';
import { CollectionGrid } from '@/components/collection/CollectionGrid';
import { PostGrid } from '@/components/post/PostGrid';
import { WardrobeGrid } from '@/components/wardrobe/WardrobeGrid';
import { spacing } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { fetchCollections } from '@/features/collections/api';
import { onCollectionsChanged } from '@/features/collections/events';
import { fetchSavedPosts, fetchUserPosts, lastUnpinnedDate } from '@/features/posts/api';
import { onPostsChanged } from '@/features/posts/events';
import { CATEGORIES, fetchWardrobe } from '@/features/wardrobe/api';
import { onWardrobeChanged } from '@/features/wardrobe/events';
import { usePagedList } from '@/hooks/usePagedList';
import { useTheme } from '@/hooks/useTheme';
import type { Collection, FeedPost, ResolvedItem, WardrobeCategory } from '@/types/database';
import { friendlyError } from '@/utils/errors';

type Section = 'outfits' | 'items' | 'saved' | 'collections';

const SECTIONS: { value: Section; label: string }[] = [
  { value: 'outfits', label: 'Kombinlerim' },
  { value: 'items', label: 'Kıyafetlerim' },
  { value: 'saved', label: 'Kaydedilenler' },
  { value: 'collections', label: 'Koleksiyonlar' },
];

// Gardırop: kişisel kombin arşivi, kıyafet envanteri, kaydedilen kombinler ve
// koleksiyonlar. Kendi kombinlerin ile başkalarının kombinleri ayrı tutulur.
export default function Wardrobe() {
  const { colors } = useTheme();
  const [section, setSection] = useState<Section>('outfits');

  const add = () => {
    if (section === 'items') router.push({ pathname: '/wardrobe/item/[id]', params: { id: 'new' } });
    else if (section === 'collections') router.push('/collection/edit');
    else router.navigate('/create');
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        left={<Text variant="title">Gardırop</Text>}
        right={<IconButton name="add" label={section === 'items' ? 'Parça ekle' : 'Ekle'} onPress={add} />}
      />
      <View style={styles.segment}>
        <Segmented options={SECTIONS} value={section} onChange={setSection} />
      </View>
      {section === 'outfits' ? <MyOutfits /> : null}
      {section === 'items' ? <MyItems /> : null}
      {section === 'saved' ? <SavedOutfits /> : null}
      {section === 'collections' ? <MyCollections /> : null}
    </SafeAreaView>
  );
}

function MyOutfits() {
  const me = useMe();
  const list = usePagedList<FeedPost>((previous) => fetchUserPosts(me.id, lastUnpinnedDate(previous)), [me.id]);
  useEffect(() => onPostsChanged(list.refresh), [list.refresh]);

  if (list.loading) return <LoadingState />;
  if (list.error && list.items.length === 0) return <ErrorState message={list.error} onRetry={list.retry} />;
  return (
    <PostGrid
      posts={list.items}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      empty={
        <EmptyState
          icon="images-outline"
          title="Kombin arşivin boş"
          message="Paylaştığın veya yalnızca kendine sakladığın kombinler burada birikir."
          actionTitle="İlk kombinini ekle"
          onAction={() => router.navigate('/create')}
        />
      }
    />
  );
}

function MyItems() {
  const [category, setCategory] = useState<WardrobeCategory | null>(null);
  const [archived, setArchived] = useState(false);
  const [items, setItems] = useState<ResolvedItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems(await fetchWardrobe({ category, status: archived ? 'archived' : 'active' }));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setRefreshing(false);
    }
  }, [category, archived]);

  useEffect(() => {
    setItems(null);
    load();
  }, [load]);
  useEffect(() => onWardrobeChanged(load), [load]);

  const filters = (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
      <Chip label="Tümü" selected={category === null} onPress={() => setCategory(null)} />
      {CATEGORIES.map((c) => (
        <Chip key={c.value} label={c.label} selected={category === c.value} onPress={() => setCategory(c.value)} />
      ))}
      <Chip label="Arşiv" selected={archived} onPress={() => setArchived((v) => !v)} />
    </ScrollView>
  );

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (items === null) return <LoadingState />;
  return (
    <WardrobeGrid
      items={items}
      header={filters}
      onPressItem={(item) => router.push({ pathname: '/wardrobe/item/[id]', params: { id: item.id } })}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      empty={
        archived ? (
          <EmptyState icon="archive-outline" title="Arşivde parça yok" />
        ) : (
          <EmptyState
            icon="shirt-outline"
            title="Gardırobuna ilk parçayı ekle"
            message="Hepsini bir anda eklemen gerekmiyor. Sık giydiğin birkaç parçayla başla; onlardan yeni kombinler oluşturabilirsin."
            actionTitle="Parça ekle"
            onAction={() => router.push({ pathname: '/wardrobe/item/[id]', params: { id: 'new' } })}
          />
        )
      }
    />
  );
}

function SavedOutfits() {
  const list = usePagedList<FeedPost>((previous) => fetchSavedPosts(previous.at(-1)?.saved_at), []);
  if (list.loading) return <LoadingState />;
  if (list.error && list.items.length === 0) return <ErrorState message={list.error} onRetry={list.retry} />;
  return (
    <PostGrid
      posts={list.items}
      refreshing={list.refreshing}
      onRefresh={list.refresh}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      header={
        <Text variant="small" tone="secondary" style={styles.note}>
          Kaydettiğin kombinleri yalnızca sen görebilirsin.
        </Text>
      }
      empty={
        <EmptyState
          icon="bookmark-outline"
          title="Henüz kaydettiğin kombin yok"
          message="Beğendiğin kombinleri kaydet simgesiyle buraya ekleyebilir, daha sonra yeniden inceleyebilirsin."
          actionTitle="Keşfet'e git"
          onAction={() => router.navigate('/explore')}
        />
      }
    />
  );
}

function MyCollections() {
  const me = useMe();
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setCollections(await fetchCollections(me.id));
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setRefreshing(false);
    }
  }, [me.id]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => onCollectionsChanged(load), [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (collections === null) return <LoadingState />;
  return (
    <CollectionGrid
      collections={collections}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      header={<View style={styles.spacer} />}
      empty={
        <EmptyState
          icon="albums-outline"
          title="Koleksiyon oluştur"
          message="Kombinlerini “Üniversite”, “Kışlık” veya “Denemek istediklerim” gibi koleksiyonlara ayır."
          actionTitle="Yeni koleksiyon"
          onAction={() => router.push('/collection/edit')}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  segment: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  filters: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: spacing.sm },
  note: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  spacer: { height: spacing.xs },
});
