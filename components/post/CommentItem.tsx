import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { Comment } from '@/types/database';
import { timeAgo } from '@/utils/format';

export function CommentItem({
  comment,
  isReply,
  onReply,
  onLongPress,
  onMenu,
}: {
  comment: Comment;
  isReply: boolean;
  onReply?: () => void;
  onLongPress?: () => void;
  onMenu?: () => void;
}) {
  const { colors } = useTheme();
  const deleted = Boolean(comment.deleted_at);
  const username = comment.author?.username ?? 'kullanıcı';
  const edited = !deleted && comment.updated_at !== comment.created_at;

  return (
    <Pressable
      style={[styles.row, isReply && styles.reply]}
      onLongPress={deleted ? undefined : onLongPress}
      accessibilityHint={deleted ? undefined : 'Seçenekler için basılı tut'}
    >
      <Pressable
        disabled={!comment.author}
        onPress={() => router.push({ pathname: '/user/[username]', params: { username } })}
        accessibilityRole="link"
        accessibilityLabel={`${username} profili`}
      >
        <Avatar path={comment.author?.avatar_path} username={username} size={isReply ? 26 : 32} />
      </Pressable>
      <View style={styles.body}>
        <Text variant="body">
          <Text variant="username">{username} </Text>
          {deleted ? (
            <Text variant="caption" tone="secondary">
              Bu yorum silindi.
            </Text>
          ) : (
            comment.body
          )}
        </Text>
        <View style={styles.meta}>
          <Text variant="small" tone="secondary">
            {timeAgo(comment.created_at)}
            {edited ? ' · düzenlendi' : ''}
          </Text>
          {!deleted && onReply ? (
            <Pressable onPress={onReply} hitSlop={8} accessibilityRole="button">
              <Text variant="small" tone="secondary" style={styles.replyLink}>
                Yanıtla
              </Text>
            </Pressable>
          ) : null}
        </View>
      </View>
      {!deleted && onMenu ? (
        <Pressable onPress={onMenu} hitSlop={10} accessibilityRole="button" accessibilityLabel="Yorum seçenekleri">
          <Ionicons name="ellipsis-horizontal" size={16} color={colors.textSecondary} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  reply: { paddingLeft: spacing.lg + 44 },
  body: { flex: 1, gap: 2 },
  meta: { flexDirection: 'row', gap: spacing.lg },
  replyLink: { fontWeight: '600' },
});
