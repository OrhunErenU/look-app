import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import * as SystemUI from 'expo-system-ui';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ActionSheetProvider } from '@/components/common/ActionSheet';
import { Screen } from '@/components/common/Screen';
import { ErrorState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { AppConfigProvider, useAppConfig } from '@/features/app-config/AppConfigProvider';
import { AuthProvider, useAuth } from '@/features/auth/AuthProvider';
import { listenForNotificationTaps, refreshPushRegistration } from '@/features/notifications/push';
import { PreferencesProvider } from '@/features/preferences/PreferencesProvider';
import { useTheme } from '@/hooks/useTheme';
import { installWebAlert } from '@/services/alert';
import { isSupabaseConfigured } from '@/services/supabase';

SplashScreen.preventAutoHideAsync().catch(() => {});
installWebAlert();

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <AppConfigProvider>
          <AuthProvider>
            <ActionSheetProvider>
              <RootNavigator />
            </ActionSheetProvider>
          </AuthProvider>
        </AppConfigProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}

function RootNavigator() {
  const { initializing, session, profile, profileError, refreshProfile } = useAuth();
  const { colors, scheme } = useTheme();
  const { maintenance } = useAppConfig();
  const ready = Boolean(session) && Boolean(profile);

  useEffect(() => {
    if (!ready) return;
    refreshPushRegistration();
    return listenForNotificationTaps();
  }, [ready]);

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

  if (maintenance.enabled) {
    return (
      <Screen>
        <Text variant="title">Kısa bir bakım arası</Text>
        <Text tone="secondary">
          {maintenance.message || 'LOOK şu anda bakımda. Kısa süre sonra tekrar deneyebilirsin.'}
        </Text>
      </Screen>
    );
  }

  const signedIn = Boolean(session);

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
          <Stack.Screen name="wardrobe/item/[id]" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="wardrobe/pick" options={{ title: 'Parça seç', presentation: 'modal' }} />
          <Stack.Screen name="collection/[id]" options={{ title: '' }} />
          <Stack.Screen name="collection/edit" options={{ title: '', presentation: 'modal' }} />
          <Stack.Screen name="collection/add" options={{ title: 'Koleksiyona ekle', presentation: 'modal' }} />
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
