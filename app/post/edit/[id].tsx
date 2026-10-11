import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Segmented } from '@/components/common/Segmented';
import { ErrorState, LoadingState } from '@/components/common/States';
import { StylePicker } from '@/components/common/StylePicker';
import { SwitchRow } from '@/components/common/SwitchRow';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { ItemStrip } from '@/components/wardrobe/ItemStrip';
import { radius, spacing } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { fetchPost, updatePost } from '@/features/posts/api';
import { notifyPostsChanged } from '@/features/posts/events';
import { fetchItemIdsForPost, fetchItemsByIds } from '@/features/wardrobe/api';
import { startPicking, usePickedItemsListener } from '@/features/wardrobe/selection';
import { useTheme } from '@/hooks/useTheme';
import type { PostVisibility, ResolvedImage, ResolvedItem } from '@/types/database';
import { friendlyError } from '@/utils/errors';
import { CAPTION_MAX, TITLE_MAX } from '@/utils/validation';

const VISIBILITY: { value: PostVisibility; label: string }[] = [
  { value: 'public', label: 'Herkese açık' },
  { value: 'followers', label: 'Takipçilerim' },
  { value: 'private', label: 'Özel' },
];

export default function EditPost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [caption, setCaption] = useState('');
  const [styleSlugs, setStyleSlugs] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [images, setImages] = useState<ResolvedImage[]>([]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([fetchPost(id), fetchItemIdsForPost(id)])
      .then(([post, ids]) => {
        if (!post || post.user_id !== me.id) {
          setLoadError('Bu paylaşımı düzenleyemezsin.');
          return;
        }
        setTitle(post.title);
        setCaption(post.caption);
        setStyleSlugs(post.styles.map((s) => s.slug));
        setVisibility(post.visibility);
        setCommentsEnabled(post.comments_enabled);
        setImages(post.images);
        setItemIds(ids);
        setLoaded(true);
      })
      .catch((e) => setLoadError(friendlyError(e)));
  }, [id, me.id]);

  useEffect(() => {
    fetchItemsByIds(itemIds)
      .then(setItems)
      .catch(() => setItems([]));
  }, [itemIds]);

  usePickedItemsListener(`edit-${id}`, useCallback((ids: string[]) => setItemIds(ids), []));

  const move = (index: number, delta: -1 | 1) =>
    setImages((prev) => {
      const next = [...prev];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updatePost(id, {
        title,
        caption,
        visibility,
        commentsEnabled,
        styleSlugs,
        itemIds,
        imageOrder: images.map((i) => i.id),
      });
      notifyPostsChanged();
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <ErrorState message={loadError} />;
  if (!loaded) return <LoadingState />;

  return (
    <Screen edges={['bottom']}>
      {images.length > 1 ? (
        <View style={styles.field}>
          <Text variant="caption" tone="secondary">
            Fotoğraf sırası · ilk fotoğraf kapak olur
          </Text>
          <View style={styles.photos}>
            {images.map((image, index) => (
              <View key={image.id} style={styles.photoCell}>
                <View style={[styles.photo, { backgroundColor: colors.skeleton }]}>
                  <Image
                    source={{ uri: image.thumbUrl, cacheKey: image.thumb_path }}
                    style={StyleSheet.absoluteFill}
                    contentFit="cover"
                  />
                </View>
                <View style={styles.moveRow}>
                  <Pressable
                    disabled={index === 0}
                    onPress={() => move(index, -1)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Öne al"
                  >
                    <Ionicons name="chevron-back" size={18} color={index === 0 ? colors.border : colors.text} />
                  </Pressable>
                  <Pressable
                    disabled={index === images.length - 1}
                    onPress={() => move(index, 1)}
                    hitSlop={6}
                    accessibilityRole="button"
                    accessibilityLabel="Arkaya al"
                  >
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={index === images.length - 1 ? colors.border : colors.text}
                    />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <TextField label="Başlık" value={title} onChangeText={setTitle} maxLength={TITLE_MAX} />
      <TextField label="Açıklama" value={caption} onChangeText={setCaption} multiline maxLength={CAPTION_MAX} showCount />
      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Etiketler
        </Text>
        <StylePicker
          selected={styleSlugs}
          onChange={setStyleSlugs}
          max={10}
          exclude={['exploring']}
          kinds={['style', 'season', 'occasion']}
        />
      </View>
      <View style={styles.field}>
        <View style={styles.row}>
          <Text variant="caption" tone="secondary" style={styles.flex}>
            Kullanılan parçalar
          </Text>
          <Button
            title={items.length ? 'Düzenle' : 'Gardıroptan ekle'}
            variant="ghost"
            compact
            onPress={() => {
              startPicking(`edit-${id}`, itemIds);
              router.push('/wardrobe/pick');
            }}
          />
        </View>
        {items.length > 0 ? <ItemStrip items={items} /> : null}
      </View>
      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Kimler görebilir?
        </Text>
        <Segmented options={VISIBILITY} value={visibility} onChange={setVisibility} />
      </View>
      <SwitchRow label="Yorumlara izin ver" value={commentsEnabled} onChange={setCommentsEnabled} />
      {error ? <Text tone="danger">{error}</Text> : null}
      <Button title="Kaydet" onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center' },
  flex: { flex: 1 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photoCell: { width: 72, gap: spacing.xs },
  photo: { width: 72, height: 96, borderRadius: radius.sm, overflow: 'hidden' },
  moveRow: { flexDirection: 'row', justifyContent: 'space-between' },
});
