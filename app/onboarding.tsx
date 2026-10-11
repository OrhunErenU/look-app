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
import { createProfile, isUsernameAvailable, suggestedProfiles, updateProfile } from '@/features/profiles/api';
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

function isoToTurkish(iso: unknown): string {
  if (typeof iso !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// Kayıttan sonra kısa profil oluşturma akışı. Profil kaydı stil seçiminden
// sonra oluşturulur; son adımda arkadaş önerileri gösterilir.
export default function Onboarding() {
  const { session, refreshProfile } = useAuth();
  const { colors } = useTheme();
  const userId = session!.user.id;

  const [step, setStep] = useState<Step>('identity');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [birthDate, setBirthDate] = useState(isoToTurkish(session?.user.user_metadata?.birth_date));
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [styleSlugs, setStyleSlugs] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [busy, setBusy] = useState(false);

  const [suggestions, setSuggestions] = useState<Profile[]>([]);
  const [follows, setFollows] = useState<Record<string, FollowStatus | null>>({});

  const nextFromIdentity = async () => {
    const next = {
      username: validateUsername(username) ?? undefined,
      birthDate: validateBirthDate(birthDate) ?? undefined,
    };
    setErrors(next);
    if (next.username || next.birthDate) return;
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
    router.replace('/explore');
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
            label="Görünen ad (isteğe bağlı)"
            value={displayName}
            onChangeText={setDisplayName}
            maxLength={DISPLAY_NAME_MAX}
          />
          <TextField
            label="Doğum tarihi"
            value={birthDate}
            onChangeText={setBirthDate}
            error={errors.birthDate}
            hint="GG.AA.YYYY · Profilinde gösterilmez."
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
          <Text tone="secondary">Birden fazla seçebilirsin. Seçim zorunlu değil.</Text>
          <StylePicker selected={styleSlugs} onChange={setStyleSlugs} />
          {errors.form ? <Text tone="danger">{errors.form}</Text> : null}
          <Button title={styleSlugs.length ? 'Devam' : 'Şimdilik atla'} onPress={finishProfile} loading={busy} />
          <Button title="Geri" variant="ghost" onPress={() => setStep('about')} />
        </>
      ) : null}

      {step === 'friends' ? (
        <>
          <Text variant="display">İnsanları bul</Text>
          <Text tone="secondary">Tarzına yakın kişileri takip ederek ana sayfanı doldur.</Text>
          <View style={styles.list}>
            {suggestions.length === 0 ? (
              <Text tone="secondary">Şu an öneri yok. Keşfet'te yeni insanlar bulabilirsin.</Text>
            ) : (
              suggestions.map((user) => (
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
          <Button title="Keşfet'e geç" onPress={finish} />
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
});
