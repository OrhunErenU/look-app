import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { TopBar } from '@/components/common/TopBar';
import { PostGrid } from '@/components/post/PostGrid';
import { fetchSavedPosts } from '@/features/posts/api';
import { usePagedList } from '@/hooks/usePagedList';
import { useTheme } from '@/hooks/useTheme';
import type { FeedPost } from '@/types/database';

// Kaydedilenler yalnızca kullanıcının kendisine görünür.
export default function Saved() {
  const { colors } = useTheme();
  const list = usePagedList<FeedPost>((previous) => fetchSavedPosts(previous.at(-1)?.saved_at), []);

  // Başka ekranlarda kaydedilen veya kaldırılan içerikler sekmeye dönüldüğünde yansısın.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) firstFocus.current = false;
      else list.refresh();
    }, [list.refresh]),
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        left={<Text variant="title">Kaydedilenler</Text>}
        right={
          <Text variant="small" tone="secondary">
            Yalnızca sen görebilirsin
          </Text>
        }
      />
      {list.loading ? (
        <LoadingState />
      ) : list.error && list.items.length === 0 ? (
        <ErrorState message={list.error} onRetry={list.retry} />
      ) : (
        <PostGrid
          posts={list.items}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          onEndReached={list.loadMore}
          loadingMore={list.loadingMore}
          empty={
            <EmptyState
              icon="bookmark-outline"
              title="Henüz kaydettiğin kombin yok"
              message="Beğendiğin kombinleri kaydet simgesiyle buraya ekleyebilir, daha sonra yeniden inceleyebilirsin."
              actionTitle="Keşfet'e git"
              onAction={() => router.push('/explore')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}
