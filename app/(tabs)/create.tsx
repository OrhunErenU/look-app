import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Segmented } from '@/components/common/Segmented';
import { StylePicker } from '@/components/common/StylePicker';
import { SwitchRow } from '@/components/common/SwitchRow';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { radius, spacing } from '@/constants/theme';
import { createPost } from '@/features/posts/api';
import { clearDraft, emptyDraft, loadDraft, saveDraft, type PostDraft } from '@/features/posts/draft';
import { notifyPostsChanged } from '@/features/posts/events';
import { useTheme } from '@/hooks/useTheme';
import type { DraftImage } from '@/services/media';
import type { OutfitDetails, PostVisibility } from '@/types/database';
import { friendlyError } from '@/utils/errors';
import { ASPECT_LABELS, type AspectOption } from '@/utils/image';
import { CAPTION_MAX } from '@/utils/validation';

const MAX_IMAGES = 5;
const MAX_STYLES = 5;

const VISIBILITY: { value: PostVisibility; label: string }[] = [
  { value: 'public', label: 'Herkese açık' },
  { value: 'followers', label: 'Takipçiler' },
  { value: 'private', label: 'Yalnızca ben' },
];

const OUTFIT_FIELDS: { key: keyof OutfitDetails; label: string }[] = [
  { key: 'top', label: 'Üst' },
  { key: 'bottom', label: 'Alt' },
  { key: 'shoes', label: 'Ayakkabı' },
  { key: 'outerwear', label: 'Dış giyim' },
  { key: 'accessory', label: 'Aksesuar' },
];

function toDraftImage(asset: ImagePicker.ImagePickerAsset): DraftImage {
  return {
    key: `${asset.assetId ?? asset.uri}-${Date.now()}`,
    uri: asset.uri,
    width: asset.width,
    height: asset.height,
    rotation: 0,
  };
}

export default function Create() {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<PostDraft>(emptyDraft);
  const [restored, setRestored] = useState(false);
  const [showOutfit, setShowOutfit] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const publishingRef = useRef(false);

  useEffect(() => {
    loadDraft().then((saved) => {
      if (saved) setDraft(saved);
      setRestored(true);
    });
  }, []);

  useEffect(() => {
    if (restored) saveDraft(draft);
  }, [draft, restored]);

  const patch = (change: Partial<PostDraft>) => setDraft((d) => ({ ...d, ...change }));

  const addFromLibrary = async () => {
    const remaining = MAX_IMAGES - draft.images.length;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: remaining > 1,
      selectionLimit: remaining,
      orderedSelection: true,
      quality: 1,
      exif: false,
    });
    if (!result.canceled) {
      patch({ images: [...draft.images, ...result.assets.slice(0, remaining).map(toDraftImage)] });
    }
  };

  const addFromCamera = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Kamera izni gerekli',
        'Kombin fotoğrafı çekmek için kamera iznini Ayarlar üzerinden verebilirsin. İstersen galeriden de seçebilirsin.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Ayarları aç', onPress: () => Linking.openSettings() },
        ],
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, exif: false });
    if (!result.canceled) patch({ images: [...draft.images, toDraftImage(result.assets[0])] });
  };

  const updateImage = (key: string, change: Partial<DraftImage> | null) =>
    patch({
      images:
        change === null
          ? draft.images.filter((i) => i.key !== key)
          : draft.images.map((i) => (i.key === key ? { ...i, ...change } : i)),
    });

  const makeCover = (key: string) => {
    const image = draft.images.find((i) => i.key === key);
    if (!image) return;
    patch({ images: [image, ...draft.images.filter((i) => i.key !== key)] });
  };

  const discard = () =>
    Alert.alert('Taslağı sil', 'Seçtiğin fotoğraflar ve yazdıkların silinecek.', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          setDraft(emptyDraft);
          clearDraft();
        },
      },
    ]);

  const publish = async () => {
    // Çift dokunuşta iki paylaşım oluşmasın.
    if (publishingRef.current) return;
    if (draft.images.length === 0) {
      setError('En az bir fotoğraf eklemelisin.');
      return;
    }
    if (draft.caption.length > CAPTION_MAX) {
      setError(`Açıklama en fazla ${CAPTION_MAX} karakter olabilir.`);
      return;
    }
    publishingRef.current = true;
    setPublishing(true);
    setError(null);
    setProgress(0);
    try {
      const id = await createPost(draft, (done, total) => setProgress(done / total));
      clearDraft();
      setDraft(emptyDraft);
      notifyPostsChanged();
      router.push({ pathname: '/post/[id]', params: { id } });
    } catch (e) {
      // Taslak korunur; kullanıcı tekrar deneyebilir.
      setError(friendlyError(e, 'Paylaşım tamamlanamadı. Taslağın kaydedildi, tekrar deneyebilirsin.'));
    } finally {
      publishingRef.current = false;
      setPublishing(false);
    }
  };

  if (!restored) return null;

  if (draft.images.length === 0) {
    return (
      <Screen edges={['top']}>
        <Text variant="display">Kombin paylaş</Text>
        <Text tone="secondary">Bugün ne giydin? En fazla {MAX_IMAGES} fotoğraf ekleyebilirsin. İlk fotoğraf kapak olur.</Text>
        <View style={styles.pickers}>
          <Pressable
            style={[styles.pickerCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={addFromLibrary}
            accessibilityRole="button"
          >
            <Ionicons name="images-outline" size={32} color={colors.text} />
            <Text variant="subtitle">Galeriden seç</Text>
          </Pressable>
          <Pressable
            style={[styles.pickerCard, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={addFromCamera}
            accessibilityRole="button"
          >
            <Ionicons name="camera-outline" size={32} color={colors.text} />
            <Text variant="subtitle">Fotoğraf çek</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top']}>
      <View style={styles.titleRow}>
        <Text variant="title">Yeni kombin</Text>
        <Button title="Taslağı sil" variant="ghost" compact onPress={discard} disabled={publishing} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.thumbs}>
        {draft.images.map((image, index) => (
          <View key={image.key} style={styles.thumbWrap}>
            <View style={[styles.thumb, { backgroundColor: colors.skeleton }]}>
              <Image
                source={{ uri: image.uri }}
                style={[StyleSheet.absoluteFill, { transform: [{ rotate: `${image.rotation}deg` }] }]}
                contentFit={draft.aspect === 'original' ? 'contain' : 'cover'}
              />
              {index === 0 ? (
                <View style={[styles.coverBadge, { backgroundColor: colors.accent }]}>
                  <Text variant="small" tone="inverse">
                    Kapak
                  </Text>
                </View>
              ) : null}
            </View>
            <View style={styles.thumbActions}>
              <ThumbAction
                icon="refresh-outline"
                label="Döndür"
                onPress={() => updateImage(image.key, { rotation: (((image.rotation + 90) % 360) as DraftImage['rotation']) })}
              />
              {index > 0 ? <ThumbAction icon="star-outline" label="Kapak yap" onPress={() => makeCover(image.key)} /> : null}
              <ThumbAction icon="trash-outline" label="Kaldır" onPress={() => updateImage(image.key, null)} />
            </View>
          </View>
        ))}
        {draft.images.length < MAX_IMAGES ? (
          <Pressable
            onPress={addFromLibrary}
            style={[styles.thumb, styles.addThumb, { borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Fotoğraf ekle"
          >
            <Ionicons name="add" size={28} color={colors.textSecondary} />
          </Pressable>
        ) : null}
      </ScrollView>

      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          En-boy oranı
        </Text>
        <Segmented<AspectOption>
          options={(Object.keys(ASPECT_LABELS) as AspectOption[]).map((value) => ({ value, label: ASPECT_LABELS[value] }))}
          value={draft.aspect}
          onChange={(aspect) => patch({ aspect })}
        />
      </View>

      <TextField
        label="Açıklama"
        placeholder="Sonbahar için sade bir kombin."
        value={draft.caption}
        onChangeText={(caption) => patch({ caption })}
        multiline
        maxLength={CAPTION_MAX}
        showCount
      />

      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Stil etiketleri (en fazla {MAX_STYLES})
        </Text>
        <StylePicker
          selected={draft.styleSlugs}
          onChange={(styleSlugs) => patch({ styleSlugs })}
          max={MAX_STYLES}
          exclude={['exploring']}
        />
      </View>

      <Pressable
        onPress={() => setShowOutfit((v) => !v)}
        style={styles.expander}
        accessibilityRole="button"
        accessibilityState={{ expanded: showOutfit }}
      >
        <Text variant="subtitle">Kıyafet detayları</Text>
        <Text variant="caption" tone="secondary">
          İsteğe bağlı
        </Text>
        <View style={styles.flex} />
        <Ionicons name={showOutfit ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </Pressable>
      {showOutfit
        ? OUTFIT_FIELDS.map((f) => (
            <TextField
              key={f.key}
              label={f.label}
              value={draft.outfit[f.key] ?? ''}
              onChangeText={(text) => patch({ outfit: { ...draft.outfit, [f.key]: text } })}
              maxLength={120}
            />
          ))
        : null}

      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Kimler görebilir?
        </Text>
        <Segmented options={VISIBILITY} value={draft.visibility} onChange={(visibility) => patch({ visibility })} />
      </View>

      <SwitchRow
        label="Yorumlara izin ver"
        value={draft.commentsEnabled}
        onChange={(commentsEnabled) => patch({ commentsEnabled })}
      />

      {error ? <Text tone="danger">{error}</Text> : null}
      {publishing ? (
        <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.accent, width: `${Math.round(progress * 100)}%` }]} />
        </View>
      ) : null}
      <Button title={publishing ? 'Paylaşılıyor…' : 'Paylaş'} onPress={publish} loading={publishing} />
    </Screen>
  );
}

function ThumbAction({
  icon,
  label,
  onPress,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label} style={styles.thumbAction}>
      <Ionicons name={icon} size={18} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pickers: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  pickerCard: {
    flex: 1,
    aspectRatio: 0.9,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  thumbs: { gap: spacing.md },
  thumbWrap: { gap: spacing.xs },
  thumb: { width: 120, height: 150, borderRadius: radius.md, overflow: 'hidden' },
  addThumb: { borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' },
  coverBadge: { position: 'absolute', left: 6, top: 6, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  thumbActions: { flexDirection: 'row', justifyContent: 'space-around' },
  thumbAction: { padding: spacing.xs },
  field: { gap: spacing.sm },
  expander: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  flex: { flex: 1 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4 },
});
