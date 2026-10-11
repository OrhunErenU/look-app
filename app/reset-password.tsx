import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { exchangeCode, updatePassword } from '@/features/auth/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { friendlyError } from '@/utils/errors';
import { validatePassword } from '@/utils/validation';

export default function ResetPassword() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  const { session } = useAuth();
  const [exchanging, setExchanging] = useState(Boolean(code));
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!code) return;
    exchangeCode(code)
      .catch((e) => setError(friendlyError(e, 'Sıfırlama bağlantısının süresi dolmuş. Yeni bağlantı iste.')))
      .finally(() => setExchanging(false));
  }, [code]);

  const submit = async () => {
    const passwordError = validatePassword(password);
    if (passwordError) {
      setError(passwordError);
      return;
    }
    setLoading(true);
    try {
      await updatePassword(password);
      router.replace('/');
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  if (exchanging) return <LoadingState />;
  if (!session) {
    return (
      <Screen>
        <Text variant="title">Bağlantı geçersiz</Text>
        <Text tone="secondary">{error ?? 'Parola sıfırlama bağlantısını yeniden iste.'}</Text>
        <Button title="Devam et" onPress={() => router.replace('/')} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Text tone="secondary">Hesabın için yeni bir parola belirle.</Text>
      <TextField
        label="Yeni parola"
        value={password}
        onChangeText={setPassword}
        error={error}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Button title="Parolayı kaydet" onPress={submit} loading={loading} />
    </Screen>
  );
}
