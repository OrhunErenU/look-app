import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/services/supabase';

// Yönetim panelinden değiştirilen uygulama ayarları: duyuru, bakım modu ve
// özellik bayrakları. Uygulama açılışta ve ön plana her geldiğinde okur.
export type AppConfig = {
  announcement: { id?: string; message: string } | null;
  maintenance: { enabled: boolean; message: string };
  features: { wardrobe: boolean; collections: boolean };
};

const DEFAULT_CONFIG: AppConfig = {
  announcement: null,
  maintenance: { enabled: false, message: '' },
  features: { wardrobe: true, collections: true },
};

const DISMISSED_KEY = 'look.dismissed-announcement';

type ContextValue = AppConfig & {
  announcementVisible: boolean;
  dismissAnnouncement: () => void;
  reload: () => void;
};

const AppConfigContext = createContext<ContextValue>({
  ...DEFAULT_CONFIG,
  announcementVisible: false,
  dismissAnnouncement: () => {},
  reload: () => {},
});

export function AppConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig>(DEFAULT_CONFIG);
  const [dismissed, setDismissed] = useState<string | null>(null);

  const reload = useCallback(() => {
    supabase
      .from('app_settings')
      .select('key, value')
      .then(({ data, error }) => {
        if (error || !data) return;
        const values = Object.fromEntries(data.map((r) => [r.key as string, r.value]));
        setConfig({
          announcement:
            values.announcement && typeof values.announcement.message === 'string' && values.announcement.message
              ? values.announcement
              : null,
          maintenance: { ...DEFAULT_CONFIG.maintenance, ...(values.maintenance ?? {}) },
          features: { ...DEFAULT_CONFIG.features, ...(values.features ?? {}) },
        });
      });
  }, []);

  useEffect(() => {
    reload();
    AsyncStorage.getItem(DISMISSED_KEY)
      .then(setDismissed)
      .catch(() => {});
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => sub.remove();
  }, [reload]);

  const announcementKey = config.announcement ? (config.announcement.id ?? config.announcement.message) : null;

  const dismissAnnouncement = () => {
    if (!announcementKey) return;
    setDismissed(announcementKey);
    AsyncStorage.setItem(DISMISSED_KEY, announcementKey).catch(() => {});
  };

  return (
    <AppConfigContext.Provider
      value={{
        ...config,
        announcementVisible: Boolean(announcementKey && announcementKey !== dismissed),
        dismissAnnouncement,
        reload,
      }}
    >
      {children}
    </AppConfigContext.Provider>
  );
}

export function useAppConfig() {
  return useContext(AppConfigContext);
}
