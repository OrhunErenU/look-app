import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, router } from 'expo-router';
import { memo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Text } from '@/components/common/Text';
import { PostGallery } from '@/components/post/PostGallery';
import { HIT_SIZE, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { FeedPost } from '@/types/database';
import { compactCount, timeAgo } from '@/utils/format';

type Props = {
  post: FeedPost;
  onLike: (post: FeedPost) => void;
  onSave: (post: FeedPost) => void;
  onMenu: (post: FeedPost) => void;
  // Ayrıntı ekranında açıklama kısaltılmaz ve yorum bağlantısı gösterilmez.
  detailed?: boolean;
};

export const PostCard = memo(function PostCard({ post, onLike, onSave, onMenu, detailed = false }: Props) {
  const { colors } = useTheme();
  const heartScale = useRef(new Animated.Value(1)).current;

  const like = () => {
    Animated.sequence([
      Animated.spring(heartScale, { toValue: 1.25, useNativeDriver: true, speed: 50 }),
      Animated.spring(heartScale, { toValue: 1, useNativeDriver: true, speed: 30 }),
    ]).start();
    onLike(post);
  };

  const openPost = () => router.push({ pathname: '/post/[id]', params: { id: post.id } });
  const openProfile = () =>
    router.push({ pathname: '/user/[username]', params: { username: post.author.username } });

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Pressable
          style={styles.author}
          onPress={openProfile}
          accessibilityRole="link"
          accessibilityLabel={`${post.author.username} profili`}
        >
          <Avatar path={post.author.avatar_path} username={post.author.username} size={34} />
          <View style={styles.flex}>
            <Text variant="username" numberOfLines={1}>
              {post.author.username}
            </Text>
            <Text variant="small" tone="secondary">
              {timeAgo(post.created_at)}
              {post.visibility !== 'public'
                ? post.visibility === 'followers'
                  ? ' · Takipçiler'
                  : ' · Yalnızca sen'
                : ''}
            </Text>
          </View>
        </Pressable>
        <Pressable
          onPress={() => onMenu(post)}
          hitSlop={8}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Seçenekler"
        >
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.text} />
        </Pressable>
      </View>

      <PostGallery images={post.images} onDoubleTap={() => !post.liked_by_me && like()} />

      <View style={styles.actions}>
        <Pressable
          onPress={like}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={post.liked_by_me ? 'Beğeniyi kaldır' : 'Beğen'}
          accessibilityState={{ selected: post.liked_by_me }}
        >
          <Animated.View style={{ transform: [{ scale: heartScale }] }}>
            <Ionicons
              name={post.liked_by_me ? 'heart' : 'heart-outline'}
              size={26}
              color={post.liked_by_me ? colors.accent : colors.text}
            />
          </Animated.View>
        </Pressable>
        <Text variant="caption" style={styles.count}>
          {compactCount(post.like_count)}
        </Text>
        <Pressable
          onPress={openPost}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Yorumlar"
        >
          <Ionicons name="chatbubble-outline" size={23} color={colors.text} />
        </Pressable>
        <Text variant="caption" style={styles.count}>
          {compactCount(post.comment_count)}
        </Text>
        <View style={styles.flex} />
        <Pressable
          onPress={() => onSave(post)}
          style={styles.iconButton}
          accessibilityRole="button"
          accessibilityLabel={post.saved_by_me ? 'Kaydı kaldır' : 'Kaydet'}
          accessibilityState={{ selected: post.saved_by_me }}
        >
          <Ionicons
            name={post.saved_by_me ? 'bookmark' : 'bookmark-outline'}
            size={23}
            color={post.saved_by_me ? colors.accent : colors.text}
          />
        </Pressable>
      </View>

      <View style={styles.body}>
        {post.caption ? (
          <Text variant="body" numberOfLines={detailed ? undefined : 3}>
            <Text variant="username">{post.author.username} </Text>
            {post.caption}
          </Text>
        ) : null}
        {post.styles.length > 0 ? (
          <View style={styles.tags}>
            {post.styles.map((style) => (
              <Link key={style.slug} href={{ pathname: '/style/[slug]', params: { slug: style.slug } }}>
                <Text variant="caption" tone="accent">
                  #{style.slug}
                </Text>
              </Link>
            ))}
          </View>
        ) : null}
        {!detailed && post.comment_count > 0 ? (
          <Pressable onPress={openPost} accessibilityRole="link">
            <Text variant="caption" tone="secondary">
              {post.comment_count} yorumun tümünü gör
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { paddingBottom: spacing.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  author: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  iconButton: { minWidth: HIT_SIZE, minHeight: HIT_SIZE, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xs },
  count: { marginLeft: -6, marginRight: spacing.sm, minWidth: 16 },
  body: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
