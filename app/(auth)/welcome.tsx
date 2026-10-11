import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Logo } from '@/components/common/Logo';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { LEGAL_URLS, openUrl } from '@/constants/links';
import { spacing } from '@/constants/theme';
import { signInWithProvider } from '@/features/auth/api';
import { friendlyError } from '@/utils/errors';

export default function Welcome() {
  const [busy, setBusy] = useState<'google' | 'apple' | null>(null);

  const oauth = async (provider: 'google' | 'apple') => {
    setBusy(provider);
    try {
      await signInWithProvider(provider);
    } catch (e) {
      Alert.alert('Giriş yapılamadı', friendlyError(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <View style={styles.hero}>
        <Logo size={44} />
        <Text variant="title" style={styles.center}>
          Tarzını paylaş. Yeni kombinler keşfet.
        </Text>
        <Text tone="secondary" style={styles.center}>
          Kombinlerini arşivle, ilham al ve moda üzerinden arkadaşlarınla bağlantı kur.
        </Text>
      </View>

      <View style={styles.actions}>
        <Button title="E-posta ile devam et" icon="mail-outline" onPress={() => router.push('/sign-in')} />
        <Button
          title="Google ile giriş"
          icon="logo-google"
          variant="secondary"
          loading={busy === 'google'}
          disabled={busy !== null}
          onPress={() => oauth('google')}
        />
        {Platform.OS === 'ios' ? (
          <Button
            title="Apple ile giriş"
            icon="logo-apple"
            variant="secondary"
            loading={busy === 'apple'}
            disabled={busy !== null}
            onPress={() => oauth('apple')}
          />
        ) : null}
        <Link href="/register" style={styles.link}>
          <Text tone="accent" variant="subtitle">
            Hesap oluştur
          </Text>
        </Link>
      </View>

      <Text variant="small" tone="secondary" style={styles.center}>
        Devam ederek{' '}
        <Text variant="small" tone="accent" onPress={() => openUrl(LEGAL_URLS.terms)}>
          Kullanım Şartları
        </Text>{' '}
        ve{' '}
        <Text variant="small" tone="accent" onPress={() => openUrl(LEGAL_URLS.privacy)}>
          Gizlilik Politikası
        </Text>
        'nı kabul etmiş olursun.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.lg, minHeight: 320 },
  center: { textAlign: 'center' },
  actions: { gap: spacing.md },
  link: { alignSelf: 'center', padding: spacing.md },
});
