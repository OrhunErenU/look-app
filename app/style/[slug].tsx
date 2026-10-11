import { Stack, useLocalSearchParams } from 'expo-router';

import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { PostGrid } from '@/components/post/PostGrid';
import { fetchStylePosts } from '@/features/posts/api';
import { useStyles } from '@/features/posts/useStyles';
import { usePagedList } from '@/hooks/usePagedList';
import type { FeedPost } from '@/types/database';

// Bir stil etiketine dokunulduğunda benzer içerikler listelenir.
export default function StylePosts() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { styles } = useStyles();
  const name = styles.find((s) => s.slug === slug)?.name ?? `#${slug}`;
  const list = usePagedList<FeedPost>((previous) => fetchStylePosts(slug, previous.length), [slug]);

  return (
    <>
      <Stack.Screen options={{ title: name }} />
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
          empty={<EmptyState icon="pricetag-outline" title="Bu stilde henüz kombin yok" />}
        />
      )}
    </>
  );
}
