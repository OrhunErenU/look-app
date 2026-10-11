import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from '@/services/supabase';

// Uygulama açıkken gelen bildirim sessizce listeye düşer; ekranı kaplamaz.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

export async function pushPermissionGranted(): Promise<boolean> {
  const status = await Notifications.getPermissionsAsync();
  return status.granted;
}

// Kullanıcı ayarlardan açtığında izin istenir. İzin verilmezse uygulama
// normal şekilde çalışmaya devam eder; bildirimler uygulama içinde görünür.
export async function enablePush(): Promise<'enabled' | 'denied' | 'unsupported'> {
  if (!Device.isDevice) return 'unsupported';

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'LOOK',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? current : await Notifications.requestPermissionsAsync();
  if (!status.granted) return 'denied';

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return 'unsupported';

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const { error } = await supabase.rpc('register_device', {
    p_token: token,
    p_platform: Platform.OS === 'ios' ? 'ios' : 'android',
  });
  if (error) throw error;
  registeredToken = token;
  return 'enabled';
}

// İzin daha önce verilmişse belirteç her açılışta tazelenir.
export async function refreshPushRegistration() {
  try {
    if (await pushPermissionGranted()) await enablePush();
  } catch {
    // Push kaydı başarısız olursa uygulama içi bildirimler çalışmaya devam eder.
  }
}

export async function disablePush() {
  if (!registeredToken) return;
  await supabase.from('device_tokens').delete().eq('token', registeredToken);
  registeredToken = null;
}

// Bildirime dokunulduğunda ilgili ekran açılır. Sunucu yalnızca uygulama
// içi yolları gönderir (ör. /post/<id>).
export function listenForNotificationTaps() {
  const open = (response: Notifications.NotificationResponse | null) => {
    const path = response?.notification.request.content.data?.path;
    if (typeof path === 'string' && path.startsWith('/')) router.push(path as never);
  };
  open(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
