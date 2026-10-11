import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Segmented } from '@/components/common/Segmented';
import { ErrorState, LoadingState } from '@/components/common/States';
import { StylePicker } from '@/components/common/StylePicker';
import { SwitchRow } from '@/components/common/SwitchRow';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { spacing } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { fetchPost, updatePost } from '@/features/posts/api';
import { notifyPostsChanged } from '@/features/posts/events';
import type { PostVisibility } from '@/types/database';
import { friendlyError } from '@/utils/errors';
import { CAPTION_MAX } from '@/utils/validation';

const VISIBILITY: { value: PostVisibility; label: string }[] = [
  { value: 'public', label: 'Herkese açık' },
  { value: 'followers', label: 'Takipçiler' },
  { value: 'private', label: 'Yalnızca ben' },
];

export default function EditPost() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [styleSlugs, setStyleSlugs] = useState<string[]>([]);
  const [visibility, setVisibility] = useState<PostVisibility>('public');
  const [commentsEnabled, setCommentsEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchPost(id)
      .then((post) => {
        if (!post || post.user_id !== me.id) {
          setLoadError('Bu paylaşımı düzenleyemezsin.');
          return;
        }
        setCaption(post.caption);
        setStyleSlugs(post.styles.map((s) => s.slug));
        setVisibility(post.visibility);
        setCommentsEnabled(post.comments_enabled);
        setLoaded(true);
      })
      .catch((e) => setLoadError(friendlyError(e)));
  }, [id, me.id]);

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await updatePost(id, { caption, visibility, commentsEnabled, styleSlugs });
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
      <TextField label="Açıklama" value={caption} onChangeText={setCaption} multiline maxLength={CAPTION_MAX} showCount />
      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Stil etiketleri
        </Text>
        <StylePicker selected={styleSlugs} onChange={setStyleSlugs} max={5} exclude={['exploring']} />
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
});
