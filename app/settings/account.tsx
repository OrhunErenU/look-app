import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { spacing } from '@/constants/theme';
import { signInWithEmail, signOut, updateEmail, updatePassword } from '@/features/auth/api';
import { useAuth, useMe } from '@/features/auth/AuthProvider';
import { deleteAccount } from '@/features/social/api';
import { useTheme } from '@/hooks/useTheme';
import { friendlyError } from '@/utils/errors';
import { validateEmail, validatePassword } from '@/utils/validation';

export default function Account() {
  const me = useMe();
  const { session } = useAuth();
  const { colors } = useTheme();
  const [email, setEmail] = useState(session?.user.email ?? '');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [busy, setBusy] = useState<'email' | 'password' | 'delete' | null>(null);
  const [confirmText, setConfirmText] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  // E-posta ile kayıtlı hesaplarda silmeden önce parola yeniden doğrulanır.
  const usesPassword = (session?.user.identities ?? []).some((i) => i.provider === 'email');

  const saveEmail = async () => {
    const error = validateEmail(email);
    if (error) return setMessage({ tone: 'danger', text: error });
    setBusy('email');
    try {
      await updateEmail(email);
      setMessage({ tone: 'success', text: 'Yeni adresine bir onay bağlantısı gönderdik.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  };

  const savePassword = async () => {
    const error = validatePassword(password);
    if (error) return setMessage({ tone: 'danger', text: error });
    setBusy('password');
    try {
      await updatePassword(password);
      setPassword('');
      setMessage({ tone: 'success', text: 'Parolan güncellendi.' });
    } catch (e) {
      setMessage({ tone: 'danger', text: friendlyError(e) });
    } finally {
      setBusy(null);
    }
  };

  const remove = () =>
    Alert.alert(
      'Hesabın kalıcı olarak silinsin mi?',
      'Profilin, tüm kombinlerin, fotoğrafların, yorumların, beğenilerin ve kaydettiklerin silinir. Bu işlem geri alınamaz.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Hesabımı sil',
          style: 'destructive',
          onPress: async () => {
            setBusy('delete');
            try {
              if (usesPassword) {
                try {
                  await signInWithEmail(session?.user.email ?? '', deletePassword);
                } catch {
                  setMessage({ tone: 'danger', text: 'Parola hatalı. Hesabın silinmedi.' });
                  setBusy(null);
                  return;
                }
              }
              await deleteAccount();
              await signOut();
            } catch (e) {
              setMessage({ tone: 'danger', text: friendlyError(e, 'Hesap silinemedi. Tekrar dene veya destek ekibine yaz.') });
              setBusy(null);
            }
          },
        },
      ],
    );

  return (
    <Screen edges={['bottom']}>
      {message ? <Text tone={message.tone}>{message.text}</Text> : null}

      <Text variant="subtitle">E-posta</Text>
      <TextField value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Button title="E-postayı güncelle" variant="secondary" onPress={saveEmail} loading={busy === 'email'} />

      <Text variant="subtitle">Parola</Text>
      <TextField
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        placeholder="Yeni parola"
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Button title="Parolayı değiştir" variant="secondary" onPress={savePassword} loading={busy === 'password'} />

      <View style={[styles.danger, { borderColor: colors.danger }]}>
        <Text variant="subtitle" tone="danger">
          Hesabı sil
        </Text>
        <Text variant="caption" tone="secondary">
          Hesabını silmek tüm içeriklerini kaldırır. Yasal saklama yükümlülükleri kapsamındaki kayıtlar (örneğin moderasyon
          işlem geçmişi) kişisel bilgilerinden ayrılarak saklanabilir. Onaylamak için kullanıcı adını yaz: @{me.username}
        </Text>
        <TextField value={confirmText} onChangeText={setConfirmText} autoCapitalize="none" placeholder={me.username} />
        {usesPassword ? (
          <TextField
            value={deletePassword}
            onChangeText={setDeletePassword}
            secureTextEntry
            placeholder="Parolan"
            autoComplete="current-password"
            accessibilityLabel="Hesabı silmek için parolan"
          />
        ) : null}
        <Button
          title="Hesabımı kalıcı olarak sil"
          variant="danger"
          onPress={remove}
          loading={busy === 'delete'}
          disabled={
            confirmText.trim().replace(/^@/, '').toLowerCase() !== me.username || (usesPassword && !deletePassword)
          }
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  danger: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: spacing.lg, gap: spacing.md, marginTop: spacing.lg },
});
