import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

type Preferences = {
  themePreference: ThemePreference;
  setThemePreference: (value: ThemePreference) => void;
};

const STORAGE_KEY = 'look.theme';

const PreferencesContext = createContext<Preferences>({
  themePreference: 'system',
  setThemePreference: () => {},
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [themePreference, setTheme] = useState<ThemePreference>('system');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((value) => {
        if (value === 'light' || value === 'dark' || value === 'system') setTheme(value);
      })
      .catch(() => {});
  }, []);

  const setThemePreference = (value: ThemePreference) => {
    setTheme(value);
    AsyncStorage.setItem(STORAGE_KEY, value).catch(() => {});
  };

  return (
    <PreferencesContext.Provider value={{ themePreference, setThemePreference }}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}
