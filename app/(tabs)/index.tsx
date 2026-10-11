import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/common/IconButton';
import { Logo } from '@/components/common/Logo';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { TopBar } from '@/components/common/TopBar';
import { PostCard } from '@/components/post/PostCard';
import { fetchHomeFeed } from '@/features/posts/api';
import { onPostsChanged } from '@/features/posts/events';
import { applyPostUpdate, usePostActions } from '@/features/posts/usePostActions';
import { unreadNotificationCount } from '@/features/social/api';
import { usePagedList } from '@/hooks/usePagedList';
import { useTheme } from '@/hooks/useTheme';
import type { FeedPost } from '@/types/database';

// Ana sayfa: takip edilen kişilerin ve kullanıcının kendi kombinleri,
// kronolojik sırada.
export default function Home() {
  const { colors } = useTheme();
  const list = usePagedList<FeedPost>(
    (previous) => fetchHomeFeed(previous.at(-1)?.created_at),
    [],
  );
  const [unread, setUnread] = useState(0);

  const update = useCallback(
    (id: string, change: Partial<FeedPost> | null) => list.setItems((prev) => applyPostUpdate(prev, id, change)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const actions = usePostActions(update);

  // Yeni paylaşım ana sayfada hemen görünsün.
  useEffect(() => onPostsChanged(list.refresh), [list.refresh]);

  useFocusEffect(
    useCallback(() => {
      unreadNotificationCount().then(setUnread).catch(() => {});
    }, []),
  );

  const header = (
    <TopBar
      left={<Logo size={22} />}
      right={
        <>
          <IconButton name="search-outline" label="Ara" onPress={() => router.push('/search')} />
          <IconButton
            name="notifications-outline"
            label="Bildirimler"
            badge={unread > 0}
            onPress={() => router.push('/notifications')}
          />
        </>
      }
    />
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      {header}
      {list.loading ? (
        <LoadingState />
      ) : list.error && list.items.length === 0 ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={actions.toggleLike}
              onSave={actions.toggleSave}
              onMenu={(p) => actions.openMenu(p)}
            />
          )}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.textSecondary} />
          }
          ListFooterComponent={
            list.loadingMore ? <ActivityIndicator style={{ padding: 24 }} color={colors.textSecondary} /> : null
          }
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="Ana sayfan henüz boş"
              message="Takip ettiğin kişilerin kombinleri burada görünecek. Keşfet'te tarzına yakın insanları bul."
              actionTitle="Keşfet'e git"
              onAction={() => router.push('/explore')}
            />
          }
          contentContainerStyle={{ flexGrow: 1 }}
          windowSize={5}
          initialNumToRender={3}
          maxToRenderPerBatch={4}
        />
      )}
    </SafeAreaView>
  );
}
