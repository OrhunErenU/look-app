import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { StylePicker } from '@/components/common/StylePicker';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { FollowButton } from '@/components/profile/FollowButton';
import { UserRow } from '@/components/profile/UserRow';
import { spacing } from '@/constants/theme';
import { signOut } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { createProfile, isUsernameAvailable, searchProfiles, suggestedProfiles, updateProfile } from '@/features/profiles/api';
import { shareProfile } from '@/features/posts/share';
import { useTheme } from '@/hooks/useTheme';
import { uploadAvatar } from '@/services/media';
import type { FollowStatus, Profile } from '@/types/database';
import { friendlyError } from '@/utils/errors';
import {
  BIO_MAX,
  DISPLAY_NAME_MAX,
  USERNAME_MAX,
  normalizeUsername,
  parseTurkishDate,
  validateBirthDate,
  validateUsername,
} from '@/utils/validation';

type Step = 'identity' | 'about' | 'styles' | 'friends';
const STEPS: Step[] = ['identity', 'about', 'styles', 'friends'];

// Kayıttan sonra kısa profil oluşturma akışı. Profil kaydı stil seçiminden
// sonra oluşturulur; son adımda arkadaş bulma ve davet seçenekleri gösterilir.
// Doğum tarihi yalnızca sunucuda yaş kontrolü için kullanılır, saklanmaz.
export default function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const userId = session!.user.id;

  const [step, setStep] = useState<Step>('identity');
  const [username, setUsername] = useState('');
  const metadataName = session?.user.user_metadata?.full_name ?? session?.user.user_metadata?.name;
  const [displayName, setDisplayName] = useState(typeof metadataName === 'string' ? metadataName.slice(0, 50) : '');
  const [birthDate, setBirthDate] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [styleSlugs, setStyleSlugs] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [follows, setFollows] = useState<Record<string, FollowStatus | null>>({});
  const [friendQuery, setFriendQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);

  useEffect(() => {
    const q = friendQuery.trim();
    if (step !== 'friends' || !q) {
      setSearchResults([]);
      return;
    }
    let active = true;
    const timer = setTimeout(() => {
      searchProfiles(q)
        .then((r) => active && setSearchResults(r.filter((p) => p.id !== userId)))
        .catch(() => active && setSearchResults([]));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [friendQuery, step, userId]);

  const nextFromIdentity = async () => {
    const next = {
      username: validateUsername(username) ?? undefined,
      displayName: displayName.trim() ? undefined : 'Görünen adını gir.',
      birthDate: validateBirthDate(birthDate) ?? undefined,
    };
    setErrors(next);
    if (next.username || next.displayName || next.birthDate) return;
    setBusy(true);
    try {
      if (!(await isUsernameAvailable(username))) {
        setErrors({ username: 'Bu kullanıcı adı alınmış.' });
        return;
      }
      setStep('about');
    } catch (e) {
      setErrors({ form: friendlyError(e) });
    } finally {
      setBusy(false);
    }
  };

  const pickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });
    if (!result.canceled) setAvatar(result.assets[0]);
  };

  const finishProfile = async () => {
    setBusy(true);
    setErrors({});
    try {
      await createProfile({
        username,
        displayName,
        bio,
        birthDate: parseTurkishDate(birthDate)!,
        styleSlugs,
      });
      if (avatar) {
        try {
          const path = await uploadAvatar(userId, avatar.uri, avatar.width, avatar.height);
          await updateProfile(userId, { avatar_path: path });
        } catch {
          Alert.alert('Profil fotoğrafı yüklenemedi', 'Daha sonra profilini düzenleyerek ekleyebilirsin.');
        }
      }
      setSuggestions(await suggestedProfiles().catch(() => []));
      setStep('friends');
    } catch (e) {
      const message = friendlyError(e);
      setErrors({ form: message });
      if (/kullanıcı adı/i.test(message)) setStep('identity');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    await refreshProfile();
    router.replace('/');
  };

  useEffect(() => {
    setErrors((prev) => (prev.form ? { form: prev.form } : {}));
  }, [step]);

  const stepIndex = STEPS.indexOf(step);

  return (
    <Screen>
      <View style={styles.progress}>
        {STEPS.map((s, i) => (
          <View
            key={s}
            style={[styles.bar, { backgroundColor: i <= stepIndex ? colors.accent : colors.border }]}
          />
        ))}
      </View>

      {step === 'identity' ? (
        <>
          <Text variant="display">Profilini oluştur</Text>
          <TextField
            label="Kullanıcı adı"
            value={username}
            onChangeText={(t) => setUsername(normalizeUsername(t))}
            error={errors.username}
            hint="Küçük harf, rakam, nokta ve alt çizgi."
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={USERNAME_MAX}
          />
          <TextField
            label="Görünen ad"
            value={displayName}
            onChangeText={setDisplayName}
            error={errors.displayName}
            maxLength={DISPLAY_NAME_MAX}
          />
          <TextField
            label="Doğum tarihi"
            value={birthDate}
            onChangeText={setBirthDate}
            error={errors.birthDate}
            hint="GG.AA.YYYY · Yalnızca yaşını doğrulamak için kullanılır, saklanmaz."
            placeholder="01.01.2000"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
          />
          {errors.form ? <Text tone="danger">{errors.form}</Text> : null}
          <Button title="Devam" onPress={nextFromIdentity} loading={busy} />
          <Button title="Çıkış yap" variant="ghost" onPress={signOut} />
        </>
      ) : null}

      {step === 'about' ? (
        <>
          <Text variant="display">Kendini tanıt</Text>
          <Pressable
            onPress={pickAvatar}
            style={[styles.avatar, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="Profil fotoğrafı seç"
          >
            {avatar ? (
              <Image source={{ uri: avatar.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
            ) : (
              <Ionicons name="camera-outline" size={32} color={colors.textSecondary} />
            )}
          </Pressable>
          <TextField
            label="Biyografi (isteğe bağlı)"
            value={bio}
            onChangeText={setBio}
            multiline
            maxLength={BIO_MAX}
            showCount
          />
          <Button title="Devam" onPress={() => setStep('styles')} />
          <Button title="Geri" variant="ghost" onPress={() => setStep('identity')} />
        </>
      ) : null}

      {step === 'styles' ? (
        <>
          <Text variant="display">Hangi tarzlar ilgini çekiyor?</Text>
          <Text tone="secondary">3 veya daha fazla stil seçmen keşfeti sana göre düzenler. Bu adımı atlayabilirsin.</Text>
          <StylePicker selected={styleSlugs} onChange={setStyleSlugs} />
          {errors.form ? <Text tone="danger">{errors.form}</Text> : null}
          <Button title={styleSlugs.length ? 'Devam' : 'Şimdilik atla'} onPress={finishProfile} loading={busy} />
          <Button title="Geri" variant="ghost" onPress={() => setStep('about')} />
        </>
      ) : null}

      {step === 'friends' ? (
        <>
          <Text variant="display">Arkadaşlarını bul</Text>
          <Text tone="secondary">
            Kullanıcı adıyla ara, arkadaşlarını davet et veya tarzına yakın kişileri takip et. Rehber erişimi istemiyoruz.
          </Text>
          <TextField
            placeholder="@kullanıcıadı ara"
            value={friendQuery}
            onChangeText={setFriendQuery}
            autoCapitalize="none"
            autoCorrect={false}
            accessibilityLabel="Kullanıcı ara"
          />
          <Button
            title="Davet bağlantısı paylaş"
            icon="share-outline"
            variant="secondary"
            onPress={() => shareProfile(normalizeUsername(username), true)}
          />
          <View style={styles.list}>
            {(friendQuery.trim() ? searchResults : suggestions).length === 0 ? (
              <Text tone="secondary" style={styles.listNote}>
                {friendQuery.trim() ? 'Bu kullanıcı adıyla kimse bulunamadı.' : 'Şu an öneri yok; ana sayfadan kombinleri keşfedebilirsin.'}
              </Text>
            ) : (
              (friendQuery.trim() ? searchResults : suggestions).map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  disableNavigation
                  right={
                    <FollowButton
                      viewerId={userId}
                      targetId={user.id}
                      status={follows[user.id] ?? null}
                      onChange={(status) => setFollows((prev) => ({ ...prev, [user.id]: status }))}
                    />
                  }
                />
              ))
            )}
          </View>
          <Button title="Devam et" onPress={finish} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  progress: { flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.sm },
  bar: { flex: 1, height: 3, borderRadius: 2 },
  avatar: {
    width: 112,
    height: 112,
    borderRadius: 56,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  list: { marginHorizontal: -spacing.xl },
  listNote: { paddingHorizontal: spacing.xl },
});
