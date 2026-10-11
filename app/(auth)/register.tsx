import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { LEGAL_URLS, openUrl } from '@/constants/links';
import { spacing } from '@/constants/theme';
import { signUpWithEmail } from '@/features/auth/api';
import { useTheme } from '@/hooks/useTheme';
import { friendlyError } from '@/utils/errors';
import { validateEmail, validatePassword } from '@/utils/validation';

type Errors = Partial<Record<'email' | 'password' | 'terms' | 'form', string>>;

export default function Register() {
  const { colors } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [loading, setLoading] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const submit = async () => {
    const next: Errors = {
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
      terms: accepted ? undefined : 'Devam etmek için şartları kabul etmelisin.',
    };
    setErrors(next);
    if (Object.values(next).some(Boolean)) return;

    setLoading(true);
    try {
      const { needsEmailConfirmation } = await signUpWithEmail(email, password);
      // Doğrulama kapalıysa oturum açılır ve yönlendirme otomatik olarak
      // profil oluşturma adımına geçer.
      if (needsEmailConfirmation) setSentTo(email.trim());
    } catch (e) {
      setErrors({ form: friendlyError(e) });
    } finally {
      setLoading(false);
    }
  };

  if (sentTo) {
    return (
      <Screen edges={['bottom']}>
        <Ionicons name="mail-open-outline" size={48} color={colors.accent} />
        <Text variant="display">E-postanı kontrol et</Text>
        <Text tone="secondary">
          {sentTo} adresine bir doğrulama bağlantısı gönderdik. Bağlantıya dokunduktan sonra profilini
          oluşturabilirsin.
        </Text>
        <Button title="Giriş ekranına dön" variant="secondary" onPress={() => router.replace('/sign-in')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="display">Hesap oluştur</Text>
      <TextField
        label="E-posta"
        value={email}
        onChangeText={setEmail}
        error={errors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Parola"
        value={password}
        onChangeText={setPassword}
        error={errors.password}
        hint="En az 8 karakter, harf ve rakam içermeli."
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <Pressable
        style={styles.terms}
        onPress={() => setAccepted((v) => !v)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: accepted }}
      >
        <Ionicons
          name={accepted ? 'checkbox' : 'square-outline'}
          size={22}
          color={accepted ? colors.accent : colors.textSecondary}
        />
        <Text variant="caption" style={styles.flex}>
          <Text variant="caption" tone="accent" onPress={() => openUrl(LEGAL_URLS.terms)}>
            Kullanım Şartları
          </Text>
          'nı okudum ve kabul ediyorum.{' '}
          <Text variant="caption" tone="accent" onPress={() => openUrl(LEGAL_URLS.privacy)}>
            Gizlilik Politikası
          </Text>{' '}
          hakkında bilgilendirildim.
        </Text>
      </Pressable>
      {errors.terms ? <Text variant="small" tone="danger">{errors.terms}</Text> : null}
      {errors.form ? <Text tone="danger">{errors.form}</Text> : null}

      <View style={styles.spacer} />
      <Button title="Hesap oluştur" onPress={submit} loading={loading} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  terms: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  flex: { flex: 1 },
  spacer: { height: spacing.sm },
});
