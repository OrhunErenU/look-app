import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Chip } from '@/components/common/Chip';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { PostGrid } from '@/components/post/PostGrid';
import { SuggestedUsers } from '@/components/profile/SuggestedUsers';
import { HIT_SIZE, radius, spacing } from '@/constants/theme';
import { fetchExplore, fetchFeatured, type ExploreFilter, type ExploreMode } from '@/features/posts/api';
import { useStyles } from '@/features/posts/useStyles';
import { usePagedList } from '@/hooks/usePagedList';
import { useTheme } from '@/hooks/useTheme';
import type { FeedPost } from '@/types/database';

const MODES: { value: ExploreMode; label: string }[] = [
  { value: 'for_you', label: 'Senin için' },
  { value: 'popular', label: 'Popüler' },
  { value: 'new', label: 'En yeni' },
  { value: 'network', label: 'Ağından' },
];

// Keşfet: kişisel sıralama, popüler/yeni kombinler, arkadaşlarının takip
// ettikleri, etiket filtreleri, öne çıkanlar ve kişi önerileri.
export default function Explore() {
  const { colors } = useTheme();
  const { styles: tags } = useStyles();
  const [filter, setFilter] = useState<ExploreFilter>({ style: null, mode: 'for_you', onlyUnfollowed: false });
  const [featured, setFeatured] = useState<FeedPost[]>([]);

  const list = usePagedList<FeedPost>(
    (previous) => fetchExplore(filter, previous.length),
    [filter.style, filter.mode, filter.onlyUnfollowed],
  );

  useEffect(() => {
    fetchFeatured().then(setFeatured).catch(() => {});
  }, []);

  const browsing = !filter.style && !filter.onlyUnfollowed && filter.mode === 'for_you';

  const header = (
    <View>
      <Pressable
        onPress={() => router.push('/search')}
        style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}
        accessibilityRole="search"
        accessibilityLabel="Kullanıcı, kombin veya stil ara"
      >
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <Text tone="secondary">Kullanıcı, kombin veya stil ara</Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
        {MODES.map((m) => (
          <Chip
            key={m.value}
            label={m.label}
            selected={filter.mode === m.value}
            onPress={() => setFilter((f) => ({ ...f, mode: m.value }))}
          />
        ))}
        <Chip
          label="Takip etmediklerim"
          selected={filter.onlyUnfollowed}
          onPress={() => setFilter((f) => ({ ...f, onlyUnfollowed: !f.onlyUnfollowed }))}
        />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagRow}>
        {tags
          .filter((t) => t.slug !== 'exploring')
          .map((t) => (
            <Chip
              key={t.slug}
              label={t.name}
              selected={filter.style === t.slug}
              onPress={() => setFilter((f) => ({ ...f, style: f.style === t.slug ? null : t.slug }))}
            />
          ))}
      </ScrollView>

      {browsing && featured.length > 0 ? <Featured posts={featured} /> : null}
      {browsing ? <SuggestedUsers /> : null}
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.titleRow}>
        <Text variant="title">Keşfet</Text>
      </View>
      {list.loading ? (
        <>
          {header}
          <LoadingState />
        </>
      ) : list.error && list.items.length === 0 ? (
        <>
          {header}
          <ErrorState message={list.error} onRetry={list.retry} />
        </>
      ) : (
        <PostGrid
          posts={list.items}
          header={header}
          refreshing={list.refreshing}
          onRefresh={list.refresh}
          onEndReached={list.loadMore}
          loadingMore={list.loadingMore}
          empty={
            <EmptyState
              icon="sparkles-outline"
              title="Burada henüz kombin yok"
              message={
                filter.mode === 'network'
                  ? 'Takip ettiğin kişilerin takip ettiği hesaplardan yeni paylaşım yok.'
                  : filter.style
                    ? 'Bu etiketle henüz paylaşım yapılmamış. İlk paylaşan sen ol.'
                    : 'Topluluk büyüdükçe kombinler burada görünecek.'
              }
              actionTitle="Kombin paylaş"
              onAction={() => router.navigate('/create')}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

// Yönetim panelinden seçilen kombinler. Örnek içerikler ayrıca etiketlenir.
function Featured({ posts }: { posts: FeedPost[] }) {
  const { colors } = useTheme();
  return (
    <View style={styles.section}>
      <Text variant="subtitle" style={styles.sectionTitle}>
        Öne çıkanlar
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
        {posts.map((p) => (
          <Pressable
            key={p.id}
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${p.title || 'Öne çıkan kombin'}${p.is_sample ? ', örnek içerik' : ''}`}
          >
            <View style={[styles.featuredCover, { backgroundColor: colors.skeleton }]}>
              <Image
                source={{ uri: p.images[0].thumbUrl, cacheKey: p.images[0].thumb_path }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
              />
              {p.is_sample ? (
                <View style={[styles.sample, { backgroundColor: colors.stone }]}>
                  <Text variant="small">Örnek</Text>
                </View>
              ) : null}
            </View>
            <Text variant="caption" numberOfLines={1} style={styles.featuredTitle}>
              {p.title || `@${p.author.username}`}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    paddingHorizontal: spacing.md,
    minHeight: HIT_SIZE,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  tagRow: { paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, gap: spacing.sm },
  section: { paddingBottom: spacing.md },
  sectionTitle: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  featuredRow: { paddingHorizontal: spacing.lg, gap: spacing.md },
  featuredCover: { width: 120, height: 160, borderRadius: radius.md, overflow: 'hidden' },
  featuredTitle: { width: 120, marginTop: spacing.xs },
  sample: { position: 'absolute', left: 6, bottom: 6, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
});
