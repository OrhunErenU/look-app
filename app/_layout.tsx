import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Screen } from '@/components/common/Screen';
import { ErrorState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { PreferencesProvider } from '@/features/preferences/PreferencesProvider';
import { useTheme } from '@/hooks/useTheme';
import { isSupabaseConfigured } from '@/services/supabase';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { initializing, session, profile, profileError, refreshProfile } = useAuth();
  const { colors, scheme } = useTheme();

  useEffect(() => {
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => {});
  }, [colors.background]);

  useEffect(() => {
    if (!initializing) SplashScreen.hideAsync().catch(() => {});
  }, [initializing]);

  if (!isSupabaseConfigured) return <MissingConfig />;
  if (initializing) return null;
  if (session && !profile && profileError) {
    return (
      <Screen>
        <ErrorState message="Profil bilgilerin yüklenemedi." onRetry={refreshProfile} />
      </Screen>
    );
  }

  const signedIn = Boolean(session);
  const ready = signedIn && Boolean(profile);

  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontWeight: '600' },
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Protected guard={ready}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="post/[id]" options={{ title: 'Kombin' }} />
          <Stack.Screen name="post/edit/[id]" options={{ title: 'Düzenle', presentation: 'modal' }} />
          <Stack.Screen name="user/[username]" options={{ title: '' }} />
          <Stack.Screen name="style/[slug]" options={{ title: '' }} />
          <Stack.Screen name="follows" options={{ title: '' }} />
          <Stack.Screen name="follow-requests" options={{ title: 'Takip istekleri' }} />
          <Stack.Screen name="search" options={{ title: 'Ara' }} />
          <Stack.Screen name="notifications" options={{ title: 'Bildirimler' }} />
          <Stack.Screen name="report" options={{ title: 'Şikâyet et', presentation: 'modal' }} />
          <Stack.Screen name="settings/index" options={{ title: 'Ayarlar' }} />
          <Stack.Screen name="settings/edit-profile" options={{ title: 'Profili düzenle' }} />
          <Stack.Screen name="settings/account" options={{ title: 'Hesap' }} />
          <Stack.Screen name="settings/blocked" options={{ title: 'Engellenen hesaplar' }} />
        </Stack.Protected>

        <Stack.Protected guard={signedIn && !profile}>
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        </Stack.Protected>

        <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
        <Stack.Screen name="reset-password" options={{ title: 'Yeni parola' }} />
      </Stack>
    </>
  );
}

function MissingConfig() {
  return (
    <Screen>
      <Text variant="title">Supabase bağlantısı eksik</Text>
      <Text tone="secondary">
        .env.example dosyasını .env olarak kopyala, EXPO_PUBLIC_SUPABASE_URL ve
        EXPO_PUBLIC_SUPABASE_ANON_KEY değerlerini doldur ve geliştirme sunucusunu yeniden başlat.
      </Text>
    </Screen>
  );
}
