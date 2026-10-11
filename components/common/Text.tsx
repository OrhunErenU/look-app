import { Text as RNText, type TextProps } from 'react-native';

import { typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type Variant = keyof typeof typography;
type Tone = 'primary' | 'secondary' | 'accent' | 'danger' | 'success' | 'inverse';

export function Text({
  variant = 'body',
  tone = 'primary',
  style,
  ...rest
}: TextProps & { variant?: Variant; tone?: Tone }) {
  const { colors } = useTheme();
  const color = {
    primary: colors.text,
    secondary: colors.textSecondary,
    accent: colors.accent,
    danger: colors.danger,
    success: colors.success,
    inverse: colors.onAccent,
  }[tone];
  return <RNText style={[typography[variant], { color }, style]} {...rest} />;
}
