import { useColorScheme } from 'react-native';

import { palette, type ColorScheme, type Colors } from '@/constants/theme';
import { usePreferences } from '@/features/preferences/PreferencesProvider';

export function useTheme(): { scheme: ColorScheme; colors: Colors } {
  const system = useColorScheme();
  const { themePreference } = usePreferences();
  const scheme: ColorScheme =
    themePreference === 'system' ? (system === 'dark' ? 'dark' : 'light') : themePreference;
  return { scheme, colors: palette[scheme] };
}
