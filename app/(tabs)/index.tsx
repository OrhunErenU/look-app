import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/common/IconButton';
import { Logo } from '@/components/common/Logo';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { TopBar } from '@/components/common/TopBar';
import { PostCard } from '@/components/post/PostCard';
import { radius, spacing } from '@/constants/theme';
import { useAppConfig } from '@/features/app-config/AppConfigProvider';
import { useMe } from '@/features/auth/AuthProvider';
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
  const me = useMe();
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
          ListHeaderComponent={
            <>
              <Announcement />
              {me.post_count === 0 ? <FirstOutfitPrompt /> : null}
            </>
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onLike={actions.toggleLike}
              onSave={actions.toggleSave}
              onShare={actions.share}
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

// Yönetim panelinden yayımlanan duyuru. Kullanıcı kapatabilir.
function Announcement() {
  const { colors } = useTheme();
  const { announcement, announcementVisible, dismissAnnouncement } = useAppConfig();
  if (!announcement || !announcementVisible) return null;
  return (
    <View style={[styles.announcement, { backgroundColor: colors.stone }]} accessibilityRole="alert">
      <Text variant="caption" style={styles.promptText}>
        {announcement.message}
      </Text>
      <Pressable onPress={dismissAnnouncement} hitSlop={10} accessibilityRole="button" accessibilityLabel="Duyuruyu kapat">
        <Ionicons name="close" size={18} color={colors.text} />
      </Pressable>
    </View>
  );
}

// Yeni kullanıcıyı zorlamadan ilk kombinini paylaşmaya davet eder.
function FirstOutfitPrompt() {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => router.navigate('/create')}
      style={[styles.prompt, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
    >
      <Ionicons name="camera-outline" size={28} color={colors.text} />
      <View style={styles.promptText}>
        <Text variant="subtitle">Bugünkü kombinini paylaş</Text>
        <Text variant="caption" tone="secondary">
          Kombinine bir isim ver, tarzını etiketle; arkadaşlarınla paylaş veya yalnızca kendine sakla.
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  prompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    margin: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
  },
  promptText: { flex: 1, gap: 2 },
  announcement: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
});
