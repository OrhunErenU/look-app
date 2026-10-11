import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useActionSheet, type SheetAction } from '@/components/common/ActionSheet';
import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { CommentItem } from '@/components/post/CommentItem';
import { PostCard } from '@/components/post/PostCard';
import { ItemStrip } from '@/components/wardrobe/ItemStrip';
import { radius, spacing, typography } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { fetchPost, fetchPostItems, fetchSimilarPosts } from '@/features/posts/api';
import { usePostActions } from '@/features/posts/usePostActions';
import { addComment, blockUser, deleteComment, editComment, fetchComments } from '@/features/social/api';
import { useTheme } from '@/hooks/useTheme';
import type { Comment, FeedPost, PostItemDetail } from '@/types/database';
import { threadComments } from '@/utils/comments';
import { friendlyError } from '@/utils/errors';
import { COMMENT_MAX } from '@/utils/validation';

const DETAIL_LABELS: Record<string, string> = {
  top: 'Üst',
  bottom: 'Alt',
  shoes: 'Ayakkabı',
  outerwear: 'Dış giyim',
  accessory: 'Aksesuar',
};

export default function PostDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const showSheet = useActionSheet();
  const inputRef = useRef<TextInput>(null);

  const [post, setPost] = useState<FeedPost | null | undefined>(undefined);
  const [comments, setComments] = useState<Comment[]>([]);
  const [items, setItems] = useState<PostItemDetail[]>([]);
  const [similar, setSimilar] = useState<FeedPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [editing, setEditing] = useState<Comment | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [p, c] = await Promise.all([fetchPost(id), fetchComments(id)]);
      setPost(p);
      setComments(c);
      if (p) {
        // Parçalar ve benzer kombinler ikincil bilgidir; hata ekranı bozmaz.
        fetchPostItems(id).then(setItems).catch(() => setItems([]));
        fetchSimilarPosts(id).then(setSimilar).catch(() => setSimilar([]));
      }
    } catch (e) {
      setError(friendlyError(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const update = useCallback((_: string, change: Partial<FeedPost> | null) => {
    setPost((prev) => (change === null ? null : prev ? { ...prev, ...change } : prev));
  }, []);
  const actions = usePostActions(update);

  const thread = useMemo(() => threadComments(comments), [comments]);

  const send = async () => {
    const body = draft.trim();
    if (!body || sending || !post) return;
    setSending(true);
    try {
      if (editing) {
        await editComment(editing.id, body);
        setComments((prev) =>
          prev.map((c) => (c.id === editing.id ? { ...c, body, updated_at: new Date().toISOString() } : c)),
        );
      } else {
        const created = await addComment(post.id, me.id, body, replyTo?.id);
        setComments((prev) => [...prev, created]);
        setPost((prev) => (prev ? { ...prev, comment_count: prev.comment_count + 1 } : prev));
      }
      setDraft('');
      setReplyTo(null);
      setEditing(null);
    } catch (e) {
      Alert.alert('Yorum gönderilemedi', friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  const commentMenu = (comment: Comment) => {
    const mine = comment.user_id === me.id;
    const canDelete = mine || post?.user_id === me.id;
    const username = comment.author?.username ?? 'kullanıcı';
    const options: SheetAction[] = [];
    if (mine) {
      options.push({
        label: 'Düzenle',
        run: () => {
          setEditing(comment);
          setReplyTo(null);
          setDraft(comment.body);
          inputRef.current?.focus();
        },
      });
    }
    if (canDelete) {
      options.push({
        label: 'Sil',
        destructive: true,
        run: async () => {
          try {
            await deleteComment(comment.id);
            setComments((prev) =>
              prev.map((c) => (c.id === comment.id ? { ...c, deleted_at: new Date().toISOString(), body: '' } : c)),
            );
            setPost((prev) => (prev ? { ...prev, comment_count: Math.max(0, prev.comment_count - 1) } : prev));
          } catch (e) {
            Alert.alert('Silinemedi', friendlyError(e));
          }
        },
      });
    }
    if (!mine) {
      options.push({
        label: 'Şikâyet et',
        destructive: true,
        run: () => router.push({ pathname: '/report', params: { commentId: comment.id, userId: comment.user_id } }),
      });
      options.push({
        label: `@${username} kullanıcısını engelle`,
        destructive: true,
        run: () =>
          Alert.alert(`@${username} engellensin mi?`, 'Birbirinizin içeriklerini ve yorumlarını göremeyeceksiniz.', [
            { text: 'Vazgeç', style: 'cancel' },
            {
              text: 'Engelle',
              style: 'destructive',
              onPress: async () => {
                try {
                  await blockUser(comment.user_id);
                  setComments((prev) => prev.filter((c) => c.user_id !== comment.user_id));
                } catch (e) {
                  Alert.alert('Engellenemedi', friendlyError(e));
                }
              },
            },
          ]),
      });
    }
    showSheet({ actions: options });
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (post === undefined) return <LoadingState />;
  if (post === null) {
    return (
      <View style={styles.flex}>
        <EmptyState
          icon="eye-off-outline"
          title="Bu kombin artık mevcut değil"
          message="Paylaşım silinmiş, gizlenmiş veya görüntüleme iznin yok."
          actionTitle="Ana sayfaya dön"
          onAction={() => router.navigate('/')}
        />
      </View>
    );
  }

  const details = Object.entries(post.outfit_details ?? {}).filter(([, v]) => Boolean(v));

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        data={thread}
        keyExtractor={(item) => item.comment.id}
        ListHeaderComponent={
          <View>
            <PostCard
              post={post}
              detailed
              onLike={actions.toggleLike}
              onSave={actions.toggleSave}
              onShare={actions.share}
              onMenu={(p) => actions.openMenu(p, { onDeleted: () => router.back() })}
            />
            {items.length > 0 ? (
              <View style={styles.section}>
                <Text variant="subtitle">Kullanılan parçalar</Text>
                <ItemStrip items={items} />
              </View>
            ) : null}
            {details.length > 0 ? (
              <View style={[styles.details, { borderColor: colors.border }]}>
                {details.map(([key, value]) => (
                  <View key={key} style={styles.detailRow}>
                    <Text variant="caption" tone="secondary" style={styles.detailLabel}>
                      {DETAIL_LABELS[key] ?? key}
                    </Text>
                    <Text variant="caption" style={styles.flex}>
                      {value}
                    </Text>
                  </View>
                ))}
              </View>
            ) : null}
            {similar.length > 0 ? <SimilarPosts posts={similar} /> : null}
            <Text variant="subtitle" style={styles.commentsTitle}>
              Yorumlar
            </Text>
            {!post.comments_enabled ? (
              <Text variant="caption" tone="secondary" style={styles.commentsTitle}>
                Bu paylaşımda yorumlar kapalı.
              </Text>
            ) : thread.length === 0 ? (
              <Text variant="caption" tone="secondary" style={styles.commentsTitle}>
                İlk yorumu sen yaz.
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <CommentItem
            comment={item.comment}
            isReply={item.isReply}
            onReply={
              post.comments_enabled
                ? () => {
                    setReplyTo(item.comment);
                    setEditing(null);
                    inputRef.current?.focus();
                  }
                : undefined
            }
            onLongPress={() => commentMenu(item.comment)}
            onMenu={() => commentMenu(item.comment)}
          />
        )}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        keyboardShouldPersistTaps="handled"
      />

      {post.comments_enabled ? (
        <View
          style={[
            styles.composer,
            { borderTopColor: colors.border, backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, spacing.sm) },
          ]}
        >
          {replyTo || editing ? (
            <View style={styles.contextRow}>
              <Text variant="small" tone="secondary" style={styles.flex}>
                {editing ? 'Yorumunu düzenliyorsun' : `@${replyTo?.author?.username ?? ''} kullanıcısına yanıt`}
              </Text>
              <Pressable
                hitSlop={10}
                onPress={() => {
                  setReplyTo(null);
                  setEditing(null);
                  setDraft('');
                }}
                accessibilityRole="button"
                accessibilityLabel="İptal"
              >
                <Ionicons name="close" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          ) : null}
          <View style={styles.inputRow}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder="Yorum ekle…"
              placeholderTextColor={colors.textSecondary}
              maxLength={COMMENT_MAX}
              multiline
              accessibilityLabel="Yorum"
              style={[
                styles.input,
                typography.body,
                { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim() || sending}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Gönder"
              style={styles.send}
            >
              <Text variant="subtitle" tone="accent" style={{ opacity: !draft.trim() || sending ? 0.4 : 1 }}>
                {editing ? 'Kaydet' : 'Gönder'}
              </Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function SimilarPosts({ posts }: { posts: FeedPost[] }) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const cell = Math.min(140, (width - spacing.lg * 2) / 2.6);
  return (
    <View style={styles.section}>
      <Text variant="subtitle">Benzer kombinler</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.similarRow}>
        {posts.map((p) => {
          const cover = p.images[0];
          return (
            <Pressable
              key={p.id}
              onPress={() => router.push({ pathname: '/post/[id]', params: { id: p.id } })}
              accessibilityRole="button"
              accessibilityLabel={p.title || `${p.author.username} kombini`}
              style={{ width: cell }}
            >
              <View style={[styles.similarCover, { height: cell * (4 / 3), backgroundColor: colors.skeleton }]}>
                <Image
                  source={{ uri: cover.thumbUrl, cacheKey: cover.thumb_path }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              </View>
              <Text variant="small" tone="secondary" numberOfLines={1}>
                @{p.author.username}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      <Button title="Keşfet'te daha fazlası" variant="ghost" compact onPress={() => router.navigate('/explore')} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  details: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  detailRow: { flexDirection: 'row', gap: spacing.md },
  detailLabel: { width: 76 },
  similarRow: { gap: spacing.md },
  similarCover: { borderRadius: radius.md, overflow: 'hidden', marginBottom: spacing.xs },
  commentsTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.xs },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  contextRow: { flexDirection: 'row', alignItems: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md },
  input: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: 9,
    paddingBottom: 9,
  },
  send: { minHeight: 40, justifyContent: 'center' },
});
