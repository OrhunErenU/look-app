import { router } from 'expo-router';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { useActionSheet } from '@/components/common/ActionSheet';
import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { IconButton } from '@/components/common/IconButton';
import { Segmented } from '@/components/common/Segmented';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { CollectionGrid } from '@/components/collection/CollectionGrid';
import { PostGrid } from '@/components/post/PostGrid';
import { FollowButton } from '@/components/profile/FollowButton';
import { spacing } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { fetchCollections } from '@/features/collections/api';
import { onCollectionsChanged } from '@/features/collections/events';
import { fetchUserPosts, lastUnpinnedDate } from '@/features/posts/api';
import { onPostsChanged } from '@/features/posts/events';
import { shareProfile } from '@/features/posts/share';
import { fetchUserStyles, followStatus } from '@/features/profiles/api';
import { blockUser } from '@/features/social/api';
import { usePagedList } from '@/hooks/usePagedList';
import type { Collection, FeedPost, FollowStatus, Profile, TagSummary } from '@/types/database';
import { friendlyError } from '@/utils/errors';
import { compactCount } from '@/utils/format';

type Tab = 'outfits' | 'collections';

export function ProfileView({ profile, onChanged }: { profile: Profile; onChanged?: () => void }) {
  const me = useMe();
  const showSheet = useActionSheet();
  const isMe = me.id === profile.id;
  const [status, setStatus] = useState<FollowStatus | null>(null);
  const [tags, setTags] = useState<Pick<TagSummary, 'slug' | 'name'>[]>([]);
  const [tab, setTab] = useState<Tab>('outfits');

  useEffect(() => {
    if (!isMe) followStatus(me.id, profile.id).then(setStatus).catch(() => {});
    fetchUserStyles(profile.id).then(setTags).catch(() => {});
  }, [isMe, me.id, profile.id]);

  const canSeeContent = isMe || !profile.is_private || status === 'accepted';

  const list = usePagedList<FeedPost>(
    (previous) =>
      canSeeContent ? fetchUserPosts(profile.id, lastUnpinnedDate(previous)) : Promise.resolve([]),
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
    showSheet({
      actions: [
        { label: 'Profili paylaş', run: () => shareProfile(profile.username, false) },
        { label: 'Şikâyet et', destructive: true, run: () => router.push({ pathname: '/report', params: { userId: profile.id } }) },
        { label: 'Engelle', destructive: true, run: block },
      ],
    });
  }, [profile.id, profile.username, showSheet]);

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
        <Text variant="subtitle">{profile.display_name}</Text>
        {profile.bio ? <Text>{profile.bio}</Text> : null}
        {tags.length > 0 ? (
          <View style={s.tags}>
            {tags.map((t) => (
              <Chip key={t.slug} label={t.name} />
            ))}
          </View>
        ) : null}
      </View>
      <View style={s.actions}>
        {isMe ? (
          <>
            <Button title="Profili düzenle" variant="secondary" compact style={s.flex} onPress={() => router.push('/settings/edit-profile')} />
            <Button
              title="Arkadaşlarını davet et"
              variant="secondary"
              compact
              style={s.flex}
              onPress={() => shareProfile(profile.username, true)}
            />
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
      {canSeeContent ? (
        <Segmented
          options={[
            { value: 'outfits', label: 'Kombinler' },
            { value: 'collections', label: 'Koleksiyonlar' },
          ]}
          value={tab}
          onChange={setTab}
        />
      ) : null}
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

  if (tab === 'collections') return <ProfileCollections userId={profile.id} isMe={isMe} header={header} />;

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
            onAction={() => router.navigate('/create')}
          />
        ) : (
          <EmptyState icon="shirt-outline" title="Henüz kombin yok" />
        )
      }
    />
  );
}

function ProfileCollections({ userId, isMe, header }: { userId: string; isMe: boolean; header: ReactElement }) {
  const [collections, setCollections] = useState<Collection[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchCollections(userId)
      .then(setCollections)
      .catch((e) => setError(friendlyError(e)));
  }, [userId]);

  useEffect(load, [load]);
  useEffect(() => (isMe ? onCollectionsChanged(load) : undefined), [isMe, load]);

  if (error) {
    return (
      <View style={s.flex}>
        {header}
        <ErrorState message={error} onRetry={load} />
      </View>
    );
  }
  if (collections === null) {
    return (
      <View style={s.flex}>
        {header}
        <LoadingState />
      </View>
    );
  }
  return (
    <CollectionGrid
      collections={collections}
      header={header}
      empty={
        isMe ? (
          <EmptyState
            icon="albums-outline"
            title="Koleksiyon oluştur"
            message="Özel koleksiyonların yalnızca sana görünür; istersen herkese açık yapabilirsin."
            actionTitle="Yeni koleksiyon"
            onAction={() => router.push('/collection/edit')}
          />
        ) : (
          <EmptyState icon="albums-outline" title="Paylaşılan koleksiyon yok" />
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
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
