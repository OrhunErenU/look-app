import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { HIT_SIZE } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export function IconButton({
  name,
  label,
  onPress,
  badge = false,
  size = 24,
}: {
  name: ComponentProps<typeof Ionicons>['name'];
  label: string;
  onPress: () => void;
  badge?: boolean;
  size?: number;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={styles.button}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, yeni` : label}
      hitSlop={4}
    >
      <Ionicons name={name} size={size} color={colors.text} />
      {badge ? <View style={[styles.badge, { backgroundColor: colors.accent }]} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { width: HIT_SIZE, height: HIT_SIZE, alignItems: 'center', justifyContent: 'center' },
  badge: { position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: 4 },
});
