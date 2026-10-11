import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActionSheetIOS, Alert, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { IconButton } from '@/components/common/IconButton';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { PostGrid } from '@/components/post/PostGrid';
import { FollowButton } from '@/components/profile/FollowButton';
import { spacing } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { fetchUserPosts } from '@/features/posts/api';
import { onPostsChanged } from '@/features/posts/events';
import { fetchUserStyles, followStatus } from '@/features/profiles/api';
import { blockUser } from '@/features/social/api';
import { usePagedList } from '@/hooks/usePagedList';
import type { FeedPost, FollowStatus, Profile, Style } from '@/types/database';
import { friendlyError } from '@/utils/errors';
import { compactCount } from '@/utils/format';

export function ProfileView({ profile, onChanged }: { profile: Profile; onChanged?: () => void }) {
  const me = useMe();
  const isMe = me.id === profile.id;
  const [status, setStatus] = useState<FollowStatus | null>(null);
  const [styles, setStyles] = useState<Pick<Style, 'slug' | 'name'>[]>([]);

  useEffect(() => {
    if (!isMe) followStatus(me.id, profile.id).then(setStatus).catch(() => {});
    fetchUserStyles(profile.id).then(setStyles).catch(() => {});
  }, [isMe, me.id, profile.id]);

  const canSeeContent = isMe || !profile.is_private || status === 'accepted';

  const list = usePagedList<FeedPost>(
    (previous) => (canSeeContent ? fetchUserPosts(profile.id, previous.at(-1)?.created_at) : Promise.resolve([])),
    [profile.id, canSeeContent],
  );

  useEffect(() => (isMe ? onPostsChanged(list.refresh) : undefined), [isMe, list.refresh]);

  const changeStatus = (next: FollowStatus | null) => {
    setStatus(next);
    onChanged?.();
  };

  const openMenu = useCallback(() => {
    const block = () =>
      Alert.alert(
        `@${profile.username} engellensin mi?`,
        'Birbirinizin profillerini ve içeriklerini göremeyecek, etkileşim kuramayacaksınız.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Engelle',
            style: 'destructive',
            onPress: async () => {
              try {
                await blockUser(profile.id);
                router.back();
              } catch (e) {
                Alert.alert('Engellenemedi', friendlyError(e));
              }
            },
          },
        ],
      );
    const report = () => router.push({ pathname: '/report', params: { userId: profile.id } });

    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Şikâyet et', 'Engelle', 'Vazgeç'], destructiveButtonIndex: [0, 1], cancelButtonIndex: 2 },
        (i) => (i === 0 ? report() : i === 1 ? block() : undefined),
      );
    } else {
      Alert.alert('Seçenekler', undefined, [
        { text: 'Şikâyet et', onPress: report },
        { text: 'Engelle', style: 'destructive', onPress: block },
        { text: 'Vazgeç', style: 'cancel' },
      ]);
    }
  }, [profile.id, profile.username]);

  const openFollows = (kind: 'followers' | 'following') => {
    if (!canSeeContent) return;
    router.push({ pathname: '/follows', params: { userId: profile.id, kind, username: profile.username } });
  };

  const header = (
    <View style={s.header}>
      <View style={s.top}>
        <Avatar path={profile.avatar_path} username={profile.username} size={84} />
        <View style={s.stats}>
          <Stat value={profile.post_count} label="Kombin" />
          <Stat value={profile.follower_count} label="Takipçi" onPress={() => openFollows('followers')} />
          <Stat value={profile.following_count} label="Takip" onPress={() => openFollows('following')} />
        </View>
      </View>
      <View style={s.bio}>
        {profile.display_name ? <Text variant="subtitle">{profile.display_name}</Text> : null}
        {profile.bio ? <Text>{profile.bio}</Text> : null}
        {styles.length > 0 ? (
          <View style={s.styles}>
            {styles.map((st) => (
              <Chip key={st.slug} label={st.name} />
            ))}
          </View>
        ) : null}
      </View>
      <View style={s.actions}>
        {isMe ? (
          <>
            <Button title="Profili düzenle" variant="secondary" compact style={s.flex} onPress={() => router.push('/settings/edit-profile')} />
            <Button title="Ayarlar" variant="secondary" compact style={s.flex} onPress={() => router.push('/settings')} />
          </>
        ) : (
          <>
            <View style={s.flex}>
              <FollowButton viewerId={me.id} targetId={profile.id} status={status} onChange={changeStatus} />
            </View>
            <IconButton name="ellipsis-horizontal" label="Seçenekler" onPress={openMenu} />
          </>
        )}
      </View>
    </View>
  );

  if (!canSeeContent) {
    return (
      <View style={s.flex}>
        {header}
        <EmptyState
          icon="lock-closed-outline"
          title="Bu hesap gizli"
          message="Kombinlerini görmek için takip isteği gönder. Hesap sahibi onayladığında paylaşımlar görünür."
        />
      </View>
    );
  }

  return list.loading ? (
    <View style={s.flex}>
      {header}
      <LoadingState />
    </View>
  ) : list.error && list.items.length === 0 ? (
    <View style={s.flex}>
      {header}
      <ErrorState message={list.error} onRetry={list.retry} />
    </View>
  ) : (
    <PostGrid
      posts={list.items}
      header={header}
      refreshing={list.refreshing}
      onRefresh={() => {
        list.refresh();
        onChanged?.();
      }}
      onEndReached={list.loadMore}
      loadingMore={list.loadingMore}
      empty={
        isMe ? (
          <EmptyState
            icon="shirt-outline"
            title="İlk kombinini paylaş"
            message="Paylaştığın kombinler burada kişisel stil arşivin olarak birikecek."
            actionTitle="Paylaş"
            onAction={() => router.push('/create')}
          />
        ) : (
          <EmptyState icon="shirt-outline" title="Henüz kombin yok" />
        )
      }
    />
  );
}

function Stat({ value, label, onPress }: { value: number; label: string; onPress?: () => void }) {
  return (
    <Pressable style={s.stat} onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : 'text'}>
      <Text variant="subtitle">{compactCount(value)}</Text>
      <Text variant="small" tone="secondary">
        {label}
      </Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  header: { padding: spacing.lg, gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  stats: { flex: 1, flexDirection: 'row', justifyContent: 'space-around' },
  stat: { alignItems: 'center', minWidth: 56, paddingVertical: spacing.xs },
  bio: { gap: spacing.xs },
  styles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
