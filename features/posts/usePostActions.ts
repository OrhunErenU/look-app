import { router } from 'expo-router';
import { useCallback } from 'react';
import { Alert } from 'react-native';

import { useActionSheet, type SheetAction } from '@/components/common/ActionSheet';
import { useAuth } from '@/features/auth/AuthProvider';
import { deletePost, hidePost, setLiked, setPinned, setSaved } from '@/features/posts/api';
import { notifyPostsChanged } from '@/features/posts/events';
import { canShare, sharePost } from '@/features/posts/share';
import { blockUser } from '@/features/social/api';
import type { FeedPost } from '@/types/database';
import { friendlyError } from '@/utils/errors';

type Update = (id: string, change: Partial<FeedPost> | null) => void;

// Beğeni ve kaydetme işlemleri iyimser güncellenir: arayüz hemen değişir,
// sunucu hata verirse eski hâline döner.
export function usePostActions(update: Update) {
  const { profile } = useAuth();
  const showSheet = useActionSheet();

  const toggleLike = useCallback(
    async (post: FeedPost) => {
      const liked = !post.liked_by_me;
      update(post.id, { liked_by_me: liked, like_count: post.like_count + (liked ? 1 : -1) });
      try {
        await setLiked(post.id, liked);
      } catch (e) {
        update(post.id, { liked_by_me: post.liked_by_me, like_count: post.like_count });
        Alert.alert('Beğeni kaydedilemedi', friendlyError(e));
      }
    },
    [update],
  );

  const toggleSave = useCallback(
    async (post: FeedPost) => {
      const saved = !post.saved_by_me;
      update(post.id, { saved_by_me: saved });
      try {
        await setSaved(post.id, saved);
      } catch (e) {
        update(post.id, { saved_by_me: post.saved_by_me });
        Alert.alert('Kaydedilemedi', friendlyError(e));
      }
    },
    [update],
  );

  const share = useCallback((post: FeedPost) => {
    sharePost(post);
  }, []);

  const openMenu = useCallback(
    (post: FeedPost, options: { allowHide?: boolean; onDeleted?: () => void } = {}) => {
      const mine = post.user_id === profile?.id;

      const confirmDelete = () =>
        Alert.alert('Paylaşımı sil', 'Bu kombin kalıcı olarak silinecek.', [
          { text: 'Vazgeç', style: 'cancel' },
          {
            text: 'Sil',
            style: 'destructive',
            onPress: async () => {
              try {
                await deletePost(post);
                update(post.id, null);
                notifyPostsChanged();
                options.onDeleted?.();
              } catch (e) {
                Alert.alert('Silinemedi', friendlyError(e));
              }
            },
          },
        ]);

      const confirmBlock = () =>
        Alert.alert(
          `@${post.author.username} engellensin mi?`,
          'Birbirinizin içeriklerini göremeyecek ve etkileşim kuramayacaksınız. Takip ilişkileri sonlanır.',
          [
            { text: 'Vazgeç', style: 'cancel' },
            {
              text: 'Engelle',
              style: 'destructive',
              onPress: async () => {
                try {
                  await blockUser(post.user_id);
                  update(post.id, null);
                } catch (e) {
                  Alert.alert('Engellenemedi', friendlyError(e));
                }
              },
            },
          ],
        );

      const hide = async () => {
        update(post.id, null);
        try {
          await hidePost(post.id);
        } catch {
          // Gizleme yalnızca kişiselleştirme içindir; hata kullanıcıyı engellemez.
        }
      };

      const togglePin = async () => {
        const pinned = !post.pinned_at;
        try {
          await setPinned(post.id, pinned);
          update(post.id, { pinned_at: pinned ? new Date().toISOString() : null });
          notifyPostsChanged();
        } catch (e) {
          Alert.alert('İşlem tamamlanamadı', friendlyError(e));
        }
      };

      const addToCollection = () => router.push({ pathname: '/collection/add', params: { postId: post.id } });

      const actions: SheetAction[] = mine
        ? [
            { label: 'Düzenle', run: () => router.push({ pathname: '/post/edit/[id]', params: { id: post.id } }) },
            { label: post.pinned_at ? 'Profilde öne çıkarmayı kaldır' : 'Profilde öne çıkar', run: togglePin },
            { label: 'Koleksiyona ekle', run: addToCollection },
            ...(canShare(post) ? [{ label: 'Bağlantıyı paylaş', run: () => share(post) }] : []),
            { label: 'Sil', destructive: true, run: confirmDelete },
          ]
        : [
            { label: 'Koleksiyona ekle', run: addToCollection },
            ...(canShare(post) ? [{ label: 'Bağlantıyı paylaş', run: () => share(post) }] : []),
            ...(options.allowHide ? [{ label: 'İlgilenmiyorum', run: hide }] : []),
            {
              label: 'Şikâyet et',
              destructive: true,
              run: () => router.push({ pathname: '/report', params: { postId: post.id, userId: post.user_id } }),
            },
            { label: `@${post.author.username} kullanıcısını engelle`, destructive: true, run: confirmBlock },
          ];

      showSheet({ actions });
    },
    [profile?.id, update, share, showSheet],
  );

  return { toggleLike, toggleSave, openMenu, share };
}

// FeedPost listesi için güncelleme yardımcı fonksiyonu.
export function applyPostUpdate(list: FeedPost[], id: string, change: Partial<FeedPost> | null) {
  if (change === null) return list.filter((p) => p.id !== id);
  return list.map((p) => (p.id === id ? { ...p, ...change } : p));
}
