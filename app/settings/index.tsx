import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';

import { ListRow, Section } from '@/components/common/ListRow';
import { Segmented } from '@/components/common/Segmented';
import { SwitchRow } from '@/components/common/SwitchRow';
import { LEGAL_URLS, SUPPORT_EMAIL, openUrl } from '@/constants/links';
import { spacing } from '@/constants/theme';
import { signOut } from '@/features/auth/api';
import { useAuth, useMe } from '@/features/auth/AuthProvider';
import { disablePush, enablePush, pushPermissionGranted } from '@/features/notifications/push';
import { usePreferences, type ThemePreference } from '@/features/preferences/PreferencesProvider';
import { updateProfile } from '@/features/profiles/api';
import { fetchNotificationSettings, updateNotificationSettings } from '@/features/social/api';
import { useTheme } from '@/hooks/useTheme';
import type { NotificationSettings } from '@/types/database';
import { friendlyError } from '@/utils/errors';

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Açık' },
  { value: 'dark', label: 'Koyu' },
  { value: 'system', label: 'Sistem' },
];

export default function Settings() {
  const me = useMe();
  const { refreshProfile } = useAuth();
  const { colors } = useTheme();
  const { themePreference, setThemePreference } = usePreferences();
  const [isPrivate, setIsPrivate] = useState(me.is_private);
  const [notif, setNotif] = useState<NotificationSettings | null>(null);
  const [pushEnabled, setPushEnabled] = useState(false);

  useEffect(() => {
    pushPermissionGranted().then(setPushEnabled).catch(() => {});
  }, []);

  const togglePush = async (value: boolean) => {
    if (!value) {
      setPushEnabled(false);
      await disablePush().catch(() => {});
      return;
    }
    try {
      const result = await enablePush();
      if (result === 'enabled') setPushEnabled(true);
      else if (result === 'denied') {
        Alert.alert('Bildirim izni kapalı', 'Telefonunun ayarlarından LOOK için bildirimlere izin verebilirsin.', [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Ayarları aç', onPress: () => Linking.openSettings() },
        ]);
      } else {
        Alert.alert('Kullanılamıyor', 'Anlık bildirimler bu cihazda veya bu sürümde kullanılamıyor.');
      }
    } catch (e) {
      Alert.alert('Bildirimler açılamadı', friendlyError(e));
    }
  };

  useEffect(() => {
    fetchNotificationSettings(me.id).then(setNotif).catch(() => {});
  }, [me.id]);

  const togglePrivate = async (value: boolean) => {
    setIsPrivate(value);
    try {
      await updateProfile(me.id, { is_private: value });
      refreshProfile();
    } catch (e) {
      setIsPrivate(!value);
      Alert.alert('Kaydedilemedi', friendlyError(e));
    }
  };

  const toggleNotif = async (key: keyof Omit<NotificationSettings, 'user_id'>, value: boolean) => {
    if (!notif) return;
    const previous = notif;
    setNotif({ ...notif, [key]: value });
    try {
      await updateNotificationSettings(me.id, { [key]: value });
    } catch (e) {
      setNotif(previous);
      Alert.alert('Kaydedilemedi', friendlyError(e));
    }
  };

  const confirmSignOut = () =>
    Alert.alert('Çıkış yap', 'Hesabından çıkış yapılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Çıkış yap', style: 'destructive', onPress: () => signOut() },
    ]);

  return (
    <ScrollView style={{ backgroundColor: colors.background }} contentContainerStyle={styles.content}>
      <Section title="Hesap">
        <ListRow icon="person-outline" label="Profili düzenle" onPress={() => router.push('/settings/edit-profile')} />
        <ListRow icon="key-outline" label="E-posta, parola ve hesap silme" onPress={() => router.push('/settings/account')} />
      </Section>

      <Section title="Gizlilik">
        <View style={styles.padded}>
          <SwitchRow
            label="Gizli hesap"
            description="Kombinlerini yalnızca onayladığın takipçiler görür. Kullanıcı adın aramada görünmeye devam eder."
            value={isPrivate}
            onChange={togglePrivate}
          />
        </View>
        {isPrivate ? (
          <ListRow icon="person-add-outline" label="Takip istekleri" onPress={() => router.push('/follow-requests')} />
        ) : null}
        <ListRow icon="ban-outline" label="Engellenen hesaplar" onPress={() => router.push('/settings/blocked')} />
      </Section>

      <Section title="Bildirimler">
        <View style={styles.padded}>
          <SwitchRow
            label="Anlık bildirimler"
            description="Telefonuna bildirim gönderilir. Kapalıyken bildirimlerini uygulama içinde görmeye devam edersin."
            value={pushEnabled}
            onChange={togglePush}
          />
          {notif ? (
            <>
              <SwitchRow label="Beğeniler" value={notif.likes} onChange={(v) => toggleNotif('likes', v)} />
              <SwitchRow label="Yorumlar ve yanıtlar" value={notif.comments} onChange={(v) => toggleNotif('comments', v)} />
              <SwitchRow label="Yeni takipçiler" value={notif.follows} onChange={(v) => toggleNotif('follows', v)} />
              <SwitchRow
                label="Takip ettiklerimin yeni paylaşımları"
                value={notif.new_posts}
                onChange={(v) => toggleNotif('new_posts', v)}
              />
            </>
          ) : null}
        </View>
      </Section>

      <Section title="Görünüm">
        <View style={[styles.padded, styles.segment]}>
          <Segmented options={THEMES} value={themePreference} onChange={setThemePreference} />
        </View>
      </Section>

      <Section title="Destek">
        <ListRow icon="help-circle-outline" label="Yardım merkezi" onPress={() => openUrl(LEGAL_URLS.help)} />
        <ListRow
          icon="bug-outline"
          label="Sorun bildir"
          onPress={() => Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=LOOK%20sorun%20bildirimi`).catch(() => {})}
        />
        <ListRow icon="shield-checkmark-outline" label="İçerik politikası" onPress={() => openUrl(LEGAL_URLS.contentPolicy)} />
        <ListRow icon="document-text-outline" label="Kullanım şartları" onPress={() => openUrl(LEGAL_URLS.terms)} />
        <ListRow icon="lock-closed-outline" label="Gizlilik politikası" onPress={() => openUrl(LEGAL_URLS.privacy)} />
        <ListRow icon="information-circle-outline" label="Uygulama sürümü" value={Constants.expoConfig?.version ?? '-'} />
      </Section>

      <Section>
        <ListRow icon="log-out-outline" label="Çıkış yap" destructive onPress={confirmSignOut} />
      </Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  padded: { paddingHorizontal: spacing.lg },
  segment: { paddingVertical: spacing.sm },
});
