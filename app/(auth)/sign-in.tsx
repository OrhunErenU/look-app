import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { spacing } from '@/constants/theme';
import { resendConfirmation, signInWithEmail } from '@/features/auth/api';
import { friendlyError } from '@/utils/errors';
import { validateEmail } from '@/utils/validation';

export default function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [unconfirmed, setUnconfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const emailError = validateEmail(email);
    if (emailError || !password) {
      setError(emailError ?? 'Parolanı gir.');
      return;
    }
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await signInWithEmail(email, password);
    } catch (e) {
      setUnconfirmed((e as { message?: string }).message === 'Email not confirmed');
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    try {
      await resendConfirmation(email);
      setNotice('Doğrulama bağlantısı tekrar gönderildi.');
    } catch (e) {
      setError(friendlyError(e));
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text variant="display">Giriş yap</Text>
      <TextField
        label="E-posta"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Parola"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        onSubmitEditing={submit}
      />
      {error ? <Text tone="danger">{error}</Text> : null}
      {notice ? <Text tone="success">{notice}</Text> : null}
      <Button title="Giriş yap" onPress={submit} loading={loading} />
      {unconfirmed ? (
        <Button title="Doğrulama e-postasını tekrar gönder" variant="ghost" onPress={resend} />
      ) : null}
      <View style={styles.links}>
        <Link href="/forgot-password">
          <Text tone="accent">Parolamı unuttum</Text>
        </Link>
        <Link href="/register" replace>
          <Text tone="accent">Hesap oluştur</Text>
        </Link>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  links: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm },
});
