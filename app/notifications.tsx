import { router } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { fetchNotifications, markAllNotificationsRead } from '@/features/social/api';
import { usePagedList } from '@/hooks/usePagedList';
import { useTheme } from '@/hooks/useTheme';
import type { Notification } from '@/types/database';
import { timeAgo } from '@/utils/format';

const MESSAGES: Record<Notification['type'], string> = {
  follow: 'seni takip etmeye başladı.',
  follow_request: 'seni takip etmek istiyor.',
  follow_accepted: 'takip isteğini kabul etti.',
  like: 'kombinini beğendi.',
  comment: 'kombinine yorum yaptı.',
  reply: 'yorumuna yanıt verdi.',
  new_post: 'yeni bir kombin paylaştı.',
  system: '',
};

export default function Notifications() {
  const me = useMe();
  const { colors } = useTheme();
  const list = usePagedList<Notification>((previous) => fetchNotifications(previous.at(-1)?.created_at), []);

  // Liste açıldığında bildirimler okundu sayılır; vurgu bu oturumda kalır.
  useEffect(() => {
    markAllNotificationsRead(me.id).catch(() => {});
  }, [me.id]);

  const open = (n: Notification) => {
    if (n.type === 'follow_request') router.push('/follow-requests');
    else if (n.post_id) router.push({ pathname: '/post/[id]', params: { id: n.post_id } });
    else if (n.actor) router.push({ pathname: '/user/[username]', params: { username: n.actor.username } });
  };

  if (list.loading) return <LoadingState />;
  if (list.error && list.items.length === 0) return <ErrorState message={list.error} onRetry={list.retry} />;

  return (
    <FlatList
      data={list.items}
      keyExtractor={(n) => n.id}
      onEndReached={list.loadMore}
      refreshControl={<RefreshControl refreshing={list.refreshing} onRefresh={list.refresh} tintColor={colors.textSecondary} />}
      ListFooterComponent={list.loadingMore ? <ActivityIndicator style={{ padding: 24 }} /> : null}
      contentContainerStyle={{ flexGrow: 1 }}
      ListEmptyComponent={
        <EmptyState icon="notifications-outline" title="Henüz bildirim yok" message="Beğeni, yorum ve takipler burada görünecek." />
      }
      renderItem={({ item }) => {
        const username = item.actor?.username ?? 'LOOK';
        return (
          <Pressable
            onPress={() => open(item)}
            style={[styles.row, !item.is_read && { backgroundColor: colors.surface }]}
            accessibilityRole="button"
          >
            <Avatar path={item.actor?.avatar_path} username={username} size={40} />
            <View style={styles.text}>
              <Text variant="caption">
                <Text variant="caption" style={styles.bold}>
                  {username}
                </Text>{' '}
                {item.type === 'system' ? item.body : MESSAGES[item.type]}
              </Text>
              <Text variant="small" tone="secondary">
                {timeAgo(item.created_at)}
              </Text>
            </View>
            {!item.is_read ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  text: { flex: 1, gap: 2 },
  bold: { fontWeight: '600' },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
