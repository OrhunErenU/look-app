import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Segmented } from '@/components/common/Segmented';
import { StylePicker } from '@/components/common/StylePicker';
import { SwitchRow } from '@/components/common/SwitchRow';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { ItemStrip } from '@/components/wardrobe/ItemStrip';
import { radius, spacing } from '@/constants/theme';
import { createPost } from '@/features/posts/api';
import { clearDraft, emptyDraft, loadDraft, saveDraft, type PostDraft } from '@/features/posts/draft';
import { notifyPostsChanged } from '@/features/posts/events';
import { fetchItemsByIds } from '@/features/wardrobe/api';
import { startPicking, usePickedItemsListener } from '@/features/wardrobe/selection';
import { useTheme } from '@/hooks/useTheme';
import type { DraftImage } from '@/services/media';
import type { OutfitDetails, PostVisibility, ResolvedItem } from '@/types/database';
import { friendlyError } from '@/utils/errors';
import { ASPECT_LABELS, type AspectOption } from '@/utils/image';
import { CAPTION_MAX, TITLE_MAX } from '@/utils/validation';

const MAX_IMAGES = 5;
const MAX_TAGS = 10;

const VISIBILITY: { value: PostVisibility; label: string; hint: string }[] = [
  { value: 'public', label: 'Herkese açık', hint: 'Keşfet ve profilinde gösterilir.' },
  { value: 'followers', label: 'Takipçilerim', hint: 'Yalnızca onayladığın takipçiler görebilir.' },
  { value: 'private', label: 'Özel', hint: 'Yalnızca sen görebilirsin; arşivinde saklanır.' },
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

function itemPhotos(items: ResolvedItem[]): DraftImage[] {
  return items
    .filter((i) => i.photo_path && i.photoUrl)
    .slice(0, MAX_IMAGES)
    .map((i) => ({
      key: `item-${i.id}`,
      uri: i.photoUrl!,
      width: 0,
      height: 0,
      rotation: 0,
      wardrobePath: i.photo_path!,
    }));
}

export default function Create() {
  const { colors } = useTheme();
  const [draft, setDraft] = useState<PostDraft>(emptyDraft);
  const [restored, setRestored] = useState(false);
  const [items, setItems] = useState<ResolvedItem[]>([]);
  const [showOutfit, setShowOutfit] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const publishingRef = useRef(false);
  // Gardıroptan başlatıldıysa seçilen parçaların fotoğrafları otomatik eklenir.
  const fromWardrobe = useRef(false);

  useEffect(() => {
    loadDraft().then((saved) => {
      if (saved) setDraft(saved);
      setRestored(true);
    });
  }, []);

  useEffect(() => {
    if (restored) saveDraft(draft);
  }, [draft, restored]);

  useEffect(() => {
    fetchItemsByIds(draft.itemIds)
      .then(setItems)
      .catch(() => setItems([]));
  }, [draft.itemIds]);

  const patch = (change: Partial<PostDraft>) => setDraft((d) => ({ ...d, ...change }));

  const onPicked = useCallback((ids: string[]) => {
    setDraft((d) => ({ ...d, itemIds: ids }));
    if (fromWardrobe.current) {
      fromWardrobe.current = false;
      fetchItemsByIds(ids)
        .then((picked) =>
          setDraft((d) => (d.images.length > 0 ? d : { ...d, images: itemPhotos(picked), aspect: 'original' })),
        )
        .catch(() => {});
    }
  }, []);
  usePickedItemsListener('create', onPicked);

  const openItemPicker = (startFromWardrobe = false) => {
    fromWardrobe.current = startFromWardrobe;
    startPicking('create', draft.itemIds);
    router.push('/wardrobe/pick');
  };

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

  const saveForLater = () => {
    saveDraft(draft);
    Alert.alert('Taslak kaydedildi', 'Paylaş sekmesine döndüğünde kaldığın yerden devam edebilirsin.');
    router.navigate('/');
  };

  const publish = async () => {
    // Çift dokunuşta iki paylaşım oluşmasın.
    if (publishingRef.current) return;
    if (draft.images.length === 0) {
      setError('En az bir fotoğraf eklemelisin. Parçalarının fotoğraflarını veya kendi fotoğrafını kullanabilirsin.');
      return;
    }
    if (draft.caption.length > CAPTION_MAX || draft.title.length > TITLE_MAX) {
      setError('Başlık veya açıklama çok uzun.');
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

  if (draft.images.length === 0 && draft.itemIds.length === 0) {
    return (
      <Screen edges={['top']}>
        <Text variant="display">Bugünkü kombinini paylaş</Text>
        <Text tone="secondary">
          En fazla {MAX_IMAGES} fotoğraf ekleyebilirsin; ilk fotoğraf kapak olur. Ya da gardırobundaki parçalardan bir
          kombin oluştur.
        </Text>
        <View style={styles.pickers}>
          <StartOption icon="images-outline" label="Galeriden seç" onPress={addFromLibrary} />
          <StartOption icon="camera-outline" label="Fotoğraf çek" onPress={addFromCamera} />
        </View>
        <StartOption icon="shirt-outline" label="Gardırobumdan oluştur" onPress={() => openItemPicker(true)} wide />
      </Screen>
    );
  }

  const visibilityHint = VISIBILITY.find((v) => v.value === draft.visibility)?.hint;

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
                source={{ uri: image.uri, cacheKey: image.wardrobePath }}
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
          <View style={styles.addColumn}>
            <Pressable
              onPress={addFromLibrary}
              style={[styles.addThumb, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Galeriden fotoğraf ekle"
            >
              <Ionicons name="images-outline" size={22} color={colors.textSecondary} />
            </Pressable>
            <Pressable
              onPress={addFromCamera}
              style={[styles.addThumb, { borderColor: colors.border }]}
              accessibilityRole="button"
              accessibilityLabel="Fotoğraf çek"
            >
              <Ionicons name="camera-outline" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      {draft.images.length > 0 ? (
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
      ) : null}

      <TextField
        label="Kombinine bir isim ver"
        placeholder="Örn. Günlük smart casual"
        value={draft.title}
        onChangeText={(title) => patch({ title })}
        maxLength={TITLE_MAX}
      />

      <TextField
        label="Açıklama"
        placeholder="Bu kombini nerede giydin? Hangi parçaları kullandın?"
        value={draft.caption}
        onChangeText={(caption) => patch({ caption })}
        multiline
        maxLength={CAPTION_MAX}
        showCount
      />

      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Tarzını etiketle (en fazla {MAX_TAGS})
        </Text>
        <StylePicker
          selected={draft.styleSlugs}
          onChange={(styleSlugs) => patch({ styleSlugs })}
          max={MAX_TAGS}
          exclude={['exploring']}
          kinds={['style', 'season', 'occasion']}
        />
      </View>

      <View style={styles.field}>
        <View style={styles.sectionRow}>
          <Text variant="caption" tone="secondary" style={styles.flex}>
            Kullanılan parçalar
          </Text>
          <Button
            title={items.length ? 'Düzenle' : 'Gardıroptan ekle'}
            variant="ghost"
            compact
            onPress={() => openItemPicker(false)}
          />
        </View>
        {items.length > 0 ? <ItemStrip items={items} /> : null}
      </View>

      <Pressable
        onPress={() => setShowOutfit((v) => !v)}
        style={styles.expander}
        accessibilityRole="button"
        accessibilityState={{ expanded: showOutfit }}
      >
        <Text variant="subtitle">Kıyafet notları</Text>
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
          Arkadaşlarınla paylaş veya profilinde sakla
        </Text>
        <Segmented options={VISIBILITY} value={draft.visibility} onChange={(visibility) => patch({ visibility })} />
        {visibilityHint ? (
          <Text variant="small" tone="secondary">
            {visibilityHint}
          </Text>
        ) : null}
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
      <Button title={publishing ? 'Yayımlanıyor…' : 'Paylaşımı yayımla'} onPress={publish} loading={publishing} />
      <Button title="Taslak olarak kaydet" variant="ghost" onPress={saveForLater} disabled={publishing} />
    </Screen>
  );
}

function StartOption({
  icon,
  label,
  onPress,
  wide = false,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  wide?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={[
        styles.pickerCard,
        wide && styles.pickerWide,
        { borderColor: colors.border, backgroundColor: colors.surface },
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={30} color={colors.text} />
      <Text variant="subtitle">{label}</Text>
    </Pressable>
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
  pickerWide: { flex: 0, aspectRatio: undefined, minHeight: 96, flexDirection: 'row' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  thumbs: { gap: spacing.md },
  thumbWrap: { gap: spacing.xs },
  thumb: { width: 120, height: 160, borderRadius: radius.md, overflow: 'hidden' },
  addColumn: { gap: spacing.sm },
  addThumb: {
    width: 76,
    height: 76,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverBadge: { position: 'absolute', left: 6, top: 6, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  thumbActions: { flexDirection: 'row', justifyContent: 'space-around' },
  thumbAction: { padding: spacing.xs },
  field: { gap: spacing.sm },
  sectionRow: { flexDirection: 'row', alignItems: 'center' },
  expander: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  flex: { flex: 1 },
  progressTrack: { height: 4, borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 4 },
});
