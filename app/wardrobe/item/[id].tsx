import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Chip } from '@/components/common/Chip';
import { Screen } from '@/components/common/Screen';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { radius, spacing } from '@/constants/theme';
import { useStyles } from '@/features/posts/useStyles';
import {
  CATEGORIES,
  SEASONS,
  deleteItem,
  fetchItem,
  saveItem,
  setItemStatus,
  type ItemInput,
  type NewPhoto,
} from '@/features/wardrobe/api';
import { notifyWardrobeChanged } from '@/features/wardrobe/events';
import { useTheme } from '@/hooks/useTheme';
import type { ResolvedItem } from '@/types/database';
import { friendlyError } from '@/utils/errors';
import { parseTurkishDate } from '@/utils/validation';

const EMPTY: ItemInput = {
  name: '',
  category: 'top',
  color: '',
  styleId: null,
  seasons: [],
  brand: '',
  purchasePrice: '',
  purchaseDate: null,
  notes: '',
  status: 'active',
};

function isoToTurkish(iso: string | null) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// Gardırop parçası ekleme ve düzenleme. Marka, fiyat ve tarih isteğe bağlıdır;
// bu bilgiler yalnızca sahibine görünür.
export default function WardrobeItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const { colors } = useTheme();
  const { styles: tags } = useStyles();

  const [existing, setExisting] = useState<ResolvedItem | null>(null);
  const [loading, setLoading] = useState(!isNew);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [input, setInput] = useState<ItemInput>(EMPTY);
  const [dateText, setDateText] = useState('');
  const [photo, setPhoto] = useState<NewPhoto | null>(null);
  const [showMore, setShowMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isNew) return;
    fetchItem(id)
      .then((item) => {
        if (!item) {
          setLoadError('Parça bulunamadı.');
          return;
        }
        setExisting(item);
        setInput({
          name: item.name,
          category: item.category,
          color: item.color ?? '',
          styleId: item.style_id,
          seasons: item.seasons,
          brand: item.brand ?? '',
          purchasePrice: item.purchase_price != null ? String(item.purchase_price).replace('.', ',') : '',
          purchaseDate: item.purchase_date,
          notes: item.notes ?? '',
          status: item.status,
        });
        setDateText(isoToTurkish(item.purchase_date));
        setShowMore(Boolean(item.brand || item.purchase_price || item.purchase_date || item.notes));
      })
      .catch((e) => setLoadError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  const patch = (change: Partial<ItemInput>) => setInput((prev) => ({ ...prev, ...change }));

  const pickPhoto = async (camera: boolean) => {
    const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
    if (camera) {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Kamera izni gerekli', 'Ayarlardan kamera iznini verebilir veya galeriden seçebilirsin.');
        return;
      }
    }
    const result = camera
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
    if (!result.canceled) {
      const asset = result.assets[0];
      setPhoto({ uri: asset.uri, width: asset.width, height: asset.height });
    }
  };

  const save = async () => {
    if (!input.name.trim()) {
      setError('Parçaya bir ad ver. Örn. Siyah oversize tişört');
      return;
    }
    const price = input.purchasePrice.trim().replace(',', '.');
    if (price && (Number.isNaN(Number(price)) || Number(price) < 0)) {
      setError('Fiyat geçerli bir sayı olmalı.');
      return;
    }
    let purchaseDate: string | null = null;
    if (dateText.trim()) {
      purchaseDate = parseTurkishDate(dateText);
      if (!purchaseDate) {
        setError('Satın alma tarihini GG.AA.YYYY biçiminde gir.');
        return;
      }
    }
    setSaving(true);
    setError(null);
    try {
      await saveItem(existing, { ...input, purchaseDate }, photo);
      notifyWardrobeChanged();
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleArchive = async () => {
    if (!existing) return;
    const next = existing.status === 'active' ? 'archived' : 'active';
    try {
      await setItemStatus(existing.id, next);
      notifyWardrobeChanged();
      router.back();
    } catch (e) {
      Alert.alert('İşlem tamamlanamadı', friendlyError(e));
    }
  };

  const remove = () =>
    Alert.alert(
      'Parçayı sil',
      'Parça gardırobundan kalıcı olarak silinir ve bağlı olduğu kombinlerden çıkarılır. Kullanmıyorsan arşivlemeyi de seçebilirsin.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            if (!existing) return;
            try {
              await deleteItem(existing);
              notifyWardrobeChanged();
              router.back();
            } catch (e) {
              Alert.alert('Silinemedi', friendlyError(e));
            }
          },
        },
      ],
    );

  if (loadError) return <ErrorState message={loadError} />;
  if (loading) return <LoadingState />;

  const preview = photo?.uri ?? existing?.photoUrl ?? null;
  const styleTags = tags.filter((t) => t.kind === 'style' && t.slug !== 'exploring');

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: isNew ? 'Parça ekle' : 'Parçayı düzenle' }} />

      <View style={[styles.photo, { backgroundColor: colors.stone }]}>
        {preview ? (
          <Image
            source={{ uri: preview, cacheKey: photo ? undefined : (existing?.photo_path ?? undefined) }}
            style={StyleSheet.absoluteFill}
            contentFit="contain"
          />
        ) : (
          <Ionicons name="shirt-outline" size={48} color={colors.textSecondary} />
        )}
      </View>
      <View style={styles.row}>
        <Button title="Galeriden seç" icon="images-outline" variant="secondary" compact style={styles.flex} onPress={() => pickPhoto(false)} />
        <Button title="Fotoğraf çek" icon="camera-outline" variant="secondary" compact style={styles.flex} onPress={() => pickPhoto(true)} />
      </View>

      <TextField
        label="Ad"
        placeholder="Siyah oversize tişört"
        value={input.name}
        onChangeText={(name) => patch({ name })}
        maxLength={80}
      />

      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Kategori
        </Text>
        <View style={styles.wrap}>
          {CATEGORIES.map((c) => (
            <Chip key={c.value} label={c.label} selected={input.category === c.value} onPress={() => patch({ category: c.value })} />
          ))}
        </View>
      </View>

      <TextField label="Renk" placeholder="Siyah" value={input.color} onChangeText={(color) => patch({ color })} maxLength={30} />

      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Stil
        </Text>
        <View style={styles.wrap}>
          {styleTags.map((t) => (
            <Chip
              key={t.slug}
              label={t.name}
              selected={input.styleId === t.id}
              onPress={() => patch({ styleId: input.styleId === t.id ? null : t.id })}
            />
          ))}
        </View>
      </View>

      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Mevsim
        </Text>
        <View style={styles.wrap}>
          {SEASONS.map((s) => (
            <Chip
              key={s.value}
              label={s.label}
              selected={input.seasons.includes(s.value)}
              onPress={() =>
                patch({
                  seasons: input.seasons.includes(s.value)
                    ? input.seasons.filter((x) => x !== s.value)
                    : [...input.seasons, s.value],
                })
              }
            />
          ))}
        </View>
      </View>

      <Pressable
        onPress={() => setShowMore((v) => !v)}
        style={styles.expander}
        accessibilityRole="button"
        accessibilityState={{ expanded: showMore }}
      >
        <Text variant="subtitle" style={styles.flex}>
          Ek bilgiler
        </Text>
        <Text variant="caption" tone="secondary">
          İsteğe bağlı · yalnızca sen görürsün
        </Text>
        <Ionicons name={showMore ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </Pressable>
      {showMore ? (
        <>
          <TextField label="Marka" value={input.brand} onChangeText={(brand) => patch({ brand })} maxLength={60} />
          <TextField
            label="Satın alma fiyatı (TL)"
            value={input.purchasePrice}
            onChangeText={(purchasePrice) => patch({ purchasePrice })}
            keyboardType="decimal-pad"
            maxLength={12}
          />
          <TextField
            label="Satın alma tarihi"
            placeholder="GG.AA.YYYY"
            value={dateText}
            onChangeText={setDateText}
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          <TextField label="Notlar" value={input.notes} onChangeText={(notes) => patch({ notes })} multiline maxLength={300} />
        </>
      ) : null}

      {existing ? (
        <Text variant="caption" tone="secondary">
          {existing.wear_count > 0 ? `${existing.wear_count} kombinde kullandın.` : 'Henüz bir kombinde kullanmadın.'}
        </Text>
      ) : null}

      {error ? <Text tone="danger">{error}</Text> : null}
      <Button title="Kaydet" onPress={save} loading={saving} />
      {existing ? (
        <>
          <Button
            title={existing.status === 'active' ? 'Arşivle' : 'Arşivden çıkar'}
            variant="secondary"
            onPress={toggleArchive}
          />
          <Button title="Parçayı sil" variant="ghost" onPress={remove} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  photo: {
    height: 260,
    borderRadius: radius.lg,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
  field: { gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  expander: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
