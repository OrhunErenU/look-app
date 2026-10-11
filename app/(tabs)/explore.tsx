import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/common/Chip';
import { IconButton } from '@/components/common/IconButton';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { TopBar } from '@/components/common/TopBar';
import { PostGrid } from '@/components/post/PostGrid';
import { SuggestedUsers } from '@/components/profile/SuggestedUsers';
import { spacing } from '@/constants/theme';
import { fetchExplore, type ExploreFilter } from '@/features/posts/api';
import { useStyles } from '@/features/posts/useStyles';
import { usePagedList } from '@/hooks/usePagedList';
import { useTheme } from '@/hooks/useTheme';
import type { FeedPost } from '@/types/database';

// Keşfet: popüler ve yeni kombinler, stil filtreleri ve kullanıcı önerileri.
export default function Explore() {
  const { colors } = useTheme();
  const { styles: styleOptions } = useStyles();
  const [filter, setFilter] = useState<ExploreFilter>({ style: null, mode: 'popular', onlyUnfollowed: false });

  const list = usePagedList<FeedPost>(
    (previous) => fetchExplore(filter, previous.length),
    [filter.style, filter.mode, filter.onlyUnfollowed],
  );

  const filters = (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        <Chip
          label="Popüler"
          selected={filter.mode === 'popular'}
          onPress={() => setFilter((f) => ({ ...f, mode: 'popular' }))}
        />
        <Chip
          label="Yeni"
          selected={filter.mode === 'new'}
          onPress={() => setFilter((f) => ({ ...f, mode: 'new' }))}
        />
        <Chip
          label="Takip etmediklerim"
          selected={filter.onlyUnfollowed}
          onPress={() => setFilter((f) => ({ ...f, onlyUnfollowed: !f.onlyUnfollowed }))}
        />
        <View style={[styles.divider, { backgroundColor: colors.border }]} />
        {styleOptions
          .filter((s) => s.slug !== 'exploring')
          .map((s) => (
            <Chip
              key={s.slug}
              label={s.name}
              selected={filter.style === s.slug}
              onPress={() => setFilter((f) => ({ ...f, style: f.style === s.slug ? null : s.slug }))}
            />
          ))}
      </ScrollView>
      {!filter.style && !filter.onlyUnfollowed ? <SuggestedUsers /> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        left={<Text variant="title">Keşfet</Text>}
        right={<IconButton name="search-outline" label="Ara" onPress={() => router.push('/search')} />}
      />
      {list.loading ? (
        <>
          {filters}
          <LoadingState />
        </>
      ) : list.error && list.items.length === 0 ? (
        <>
          {filters}
          <ErrorState message={list.error} onRetry={list.retry} />
        </>
      ) : (
        <PostGrid
          posts={list.items}
          header={filters}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          onEndReached={list.loadMore}
          loadingMore={list.loadingMore}
          empty={
            <EmptyState
              icon="sparkles-outline"
              title="Henüz kombin yok"
              message={
                filter.style
                  ? 'Bu stilde henüz paylaşım yapılmamış. İlk paylaşan sen ol.'
                  : 'İlk kombinler paylaşıldıkça burada görünecek.'
              }
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  filters: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: spacing.sm, alignItems: 'center' },
  divider: { width: StyleSheet.hairlineWidth, height: 20, marginHorizontal: spacing.xs },
});
