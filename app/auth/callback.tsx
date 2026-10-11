import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { exchangeCode } from '@/features/auth/api';
import { friendlyError } from '@/utils/errors';

// E-posta doğrulama ve OAuth bağlantıları bu ekrana döner. Kod oturuma
// çevrildiğinde kök yönlendirme kullanıcıyı doğru ekrana taşır.
export default function AuthCallback() {
  const { code, error_description } = useLocalSearchParams<{ code?: string; error_description?: string }>();
  const [error, setError] = useState<string | null>(error_description ?? null);

  useEffect(() => {
    if (!code) {
      if (!error_description) router.replace('/');
      return;
    }
    exchangeCode(code)
      .then(() => router.replace('/'))
      .catch((e) => setError(friendlyError(e, 'Bağlantının süresi dolmuş olabilir. Tekrar giriş yap.')));
  }, [code, error_description]);

  if (!error) return <LoadingState />;
  return (
    <Screen>
      <Text variant="title">Doğrulama tamamlanamadı</Text>
      <Text tone="secondary">{error}</Text>
      <Button title="Devam et" onPress={() => router.replace('/')} />
    </Screen>
  );
}
