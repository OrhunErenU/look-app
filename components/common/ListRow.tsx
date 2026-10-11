import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export function ListRow({
  icon,
  label,
  value,
  onPress,
  destructive = false,
}: {
  icon?: ComponentProps<typeof Ionicons>['name'];
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
      accessibilityRole={onPress ? 'button' : 'text'}
    >
      {icon ? <Ionicons name={icon} size={20} color={destructive ? colors.danger : colors.text} /> : null}
      <Text tone={destructive ? 'danger' : 'primary'} style={styles.label}>
        {label}
      </Text>
      {value ? (
        <Text variant="caption" tone="secondary">
          {value}
        </Text>
      ) : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} /> : null}
    </Pressable>
  );
}

export function Section({ title, children }: { title?: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.section, { borderColor: colors.border }]}>
      {title ? (
        <Text variant="small" tone="secondary" style={styles.sectionTitle}>
          {title.toLocaleUpperCase('tr-TR')}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 48, paddingHorizontal: spacing.lg },
  label: { flex: 1 },
  section: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: spacing.sm },
  sectionTitle: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, letterSpacing: 0.5 },
});
