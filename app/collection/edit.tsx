import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Segmented } from '@/components/common/Segmented';
import { ErrorState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { spacing } from '@/constants/theme';
import { COLLECTION_VISIBILITY, fetchCollection, saveCollection, setInCollection } from '@/features/collections/api';
import { notifyCollectionsChanged } from '@/features/collections/events';
import type { CollectionVisibility } from '@/types/database';
import { friendlyError } from '@/utils/errors';

// Koleksiyon oluşturma ve düzenleme. `addPostId` verilirse yeni koleksiyon
// oluşturulduğunda o kombin hemen eklenir.
export default function EditCollection() {
  const { id, addPostId } = useLocalSearchParams<{ id?: string; addPostId?: string }>();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<CollectionVisibility>('private');
  const [loading, setLoading] = useState(Boolean(id));
  const [loadError, setLoadError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    fetchCollection(id)
      .then((c) => {
        if (!c) {
          setLoadError('Koleksiyon bulunamadı.');
          return;
        }
        setName(c.name);
        setDescription(c.description ?? '');
        setVisibility(c.visibility);
      })
      .catch((e) => setLoadError(friendlyError(e)))
      .finally(() => setLoading(false));
  }, [id]);

  const save = async () => {
    if (!name.trim()) {
      setError('Koleksiyona bir ad ver.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const saved = await saveCollection(id ?? null, { name, description, visibility });
      if (!id && addPostId) await setInCollection(saved.id, addPostId, true);
      notifyCollectionsChanged();
      router.back();
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loadError) return <ErrorState message={loadError} />;
  if (loading) return <LoadingState />;

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: id ? 'Koleksiyonu düzenle' : 'Yeni koleksiyon' }} />
      <TextField label="Ad" placeholder="Örn. Üniversite" value={name} onChangeText={setName} maxLength={50} />
      <TextField
        label="Açıklama (isteğe bağlı)"
        value={description}
        onChangeText={setDescription}
        multiline
        maxLength={200}
        showCount
      />
      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Kimler görebilir?
        </Text>
        <Segmented options={COLLECTION_VISIBILITY} value={visibility} onChange={setVisibility} />
        <Text variant="small" tone="secondary">
          Koleksiyon herkese açık olsa bile içindeki kombinleri yalnızca görme izni olan kişiler görür.
        </Text>
      </View>
      {error ? <Text tone="danger">{error}</Text> : null}
      <Button title="Kaydet" onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  field: { gap: spacing.sm },
});
