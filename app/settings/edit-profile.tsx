import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { StylePicker } from '@/components/common/StylePicker';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { spacing } from '@/constants/theme';
import { useAuth, useMe } from '@/features/auth/AuthProvider';
import { fetchUserStyles, isUsernameAvailable, setUserStyles, updateProfile } from '@/features/profiles/api';
import { removeAvatar, uploadAvatar } from '@/services/media';
import { friendlyError } from '@/utils/errors';
import { BIO_MAX, DISPLAY_NAME_MAX, USERNAME_MAX, normalizeUsername, validateUsername } from '@/utils/validation';

export default function EditProfile() {
  const me = useMe();
  const { refreshProfile } = useAuth();
  const [username, setUsername] = useState(me.username);
  const [displayName, setDisplayName] = useState(me.display_name ?? '');
  const [bio, setBio] = useState(me.bio ?? '');
  const [styleSlugs, setStyleSlugs] = useState<string[]>([]);
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [removeCurrent, setRemoveCurrent] = useState(false);
  const [errors, setErrors] = useState<{ username?: string; form?: string }>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUserStyles(me.id)
      .then((s) => setStyleSlugs(s.map((x) => x.slug)))
      .catch(() => {});
  }, [me.id]);

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) {
      setAvatar(result.assets[0]);
      setRemoveCurrent(false);
    }
  };

  const save = async () => {
    const usernameError = validateUsername(username);
    if (usernameError) {
      setErrors({ username: usernameError });
      return;
    }
    if (!displayName.trim()) {
      setErrors({ form: 'Görünen ad boş bırakılamaz.' });
      return;
    }
    setSaving(true);
    setErrors({});
    try {
      const nextUsername = normalizeUsername(username);
      if (nextUsername !== me.username && !(await isUsernameAvailable(nextUsername))) {
        setErrors({ username: 'Bu kullanıcı adı alınmış.' });
        return;
      }

      let avatarPath = me.avatar_path;
      if (avatar) avatarPath = await uploadAvatar(me.id, avatar.uri, avatar.width, avatar.height);
      else if (removeCurrent) avatarPath = null;

      await updateProfile(me.id, {
        username: nextUsername,
        display_name: displayName.trim(),
        bio: bio.trim() || null,
        avatar_path: avatarPath,
      });
      await setUserStyles(me.id, styleSlugs);
      if (avatarPath !== me.avatar_path) await removeAvatar(me.avatar_path);
      await refreshProfile();
      router.back();
    } catch (e) {
      setErrors({ form: friendlyError(e) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={styles.avatarRow}>
        <Pressable onPress={pickAvatar} accessibilityRole="button" accessibilityLabel="Profil fotoğrafını değiştir">
          {avatar ? (
            <Image source={{ uri: avatar.uri }} style={styles.avatar} contentFit="cover" />
          ) : (
            <Avatar path={removeCurrent ? null : me.avatar_path} username={me.username} size={88} />
          )}
        </Pressable>
        <View style={styles.avatarActions}>
          <Button title="Fotoğrafı değiştir" compact variant="secondary" onPress={pickAvatar} />
          {(me.avatar_path && !removeCurrent) || avatar ? (
            <Button
              title="Kaldır"
              compact
              variant="ghost"
              onPress={() => {
                setAvatar(null);
                setRemoveCurrent(true);
              }}
            />
          ) : null}
        </View>
      </View>

      <TextField
        label="Kullanıcı adı"
        value={username}
        onChangeText={(t) => setUsername(normalizeUsername(t))}
        error={errors.username}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={USERNAME_MAX}
        hint="Kullanıcı adını 30 günde bir değiştirebilirsin."
      />
      <TextField label="Görünen ad" value={displayName} onChangeText={setDisplayName} maxLength={DISPLAY_NAME_MAX} />
      <TextField label="Biyografi" value={bio} onChangeText={setBio} multiline maxLength={BIO_MAX} showCount />
      <View style={styles.field}>
        <Text variant="caption" tone="secondary">
          Stil tercihlerin
        </Text>
        <StylePicker selected={styleSlugs} onChange={setStyleSlugs} />
      </View>
      {errors.form ? <Text tone="danger">{errors.form}</Text> : null}
      <Button title="Kaydet" onPress={save} loading={saving} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xl },
  avatar: { width: 88, height: 88, borderRadius: 44 },
  avatarActions: { gap: spacing.sm, alignItems: 'flex-start' },
  field: { gap: spacing.sm },
});
