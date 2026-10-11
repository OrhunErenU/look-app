import { useState } from 'react';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { sendPasswordReset } from '@/features/auth/api';
import { friendlyError } from '@/utils/errors';
import { validateEmail } from '@/utils/validation';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await sendPasswordReset(email);
      setSent(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <Text variant="display">Parolanı sıfırla</Text>
      {sent ? (
        // Hesabın varlığı açığa çıkmasın diye her durumda aynı mesaj gösterilir.
        <Text tone="secondary">
          Bu adrese kayıtlı bir hesap varsa parola sıfırlama bağlantısı gönderildi. Gelen kutunu kontrol et.
        </Text>
      ) : (
        <>
          <Text tone="secondary">Hesabına bağlı e-posta adresini gir, sana bir sıfırlama bağlantısı gönderelim.</Text>
          <TextField
            label="E-posta"
            value={email}
            onChangeText={setEmail}
            error={error}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
          />
          <Button title="Bağlantı gönder" onPress={submit} loading={loading} />
        </>
      )}
    </Screen>
  );
}
