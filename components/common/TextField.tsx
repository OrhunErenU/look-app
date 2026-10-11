import { forwardRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { Text } from '@/components/common/Text';
import { HIT_SIZE, radius, spacing, typography } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type Props = TextInputProps & {
  label?: string;
  error?: string | null;
  hint?: string;
  maxLength?: number;
  showCount?: boolean;
};

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, error, hint, showCount, maxLength, value, style, multiline, ...rest },
  ref,
) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrapper}>
      {label ? (
        <Text variant="caption" tone="secondary" style={styles.label}>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        value={value}
        maxLength={maxLength}
        multiline={multiline}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={label}
        style={[
          styles.input,
          typography.body,
          multiline && styles.multiline,
          {
            color: colors.text,
            backgroundColor: colors.surface,
            borderColor: error ? colors.danger : colors.border,
          },
          style,
        ]}
        {...rest}
      />
      <View style={styles.footer}>
        {error ? (
          <Text variant="small" tone="danger" style={styles.flex}>
            {error}
          </Text>
        ) : hint ? (
          <Text variant="small" tone="secondary" style={styles.flex}>
            {hint}
          </Text>
        ) : (
          <View style={styles.flex} />
        )}
        {showCount && maxLength ? (
          <Text variant="small" tone="secondary">
            {value?.length ?? 0}/{maxLength}
          </Text>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { marginLeft: 2 },
  input: {
    minHeight: HIT_SIZE + 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  footer: { flexDirection: 'row', minHeight: 16, gap: spacing.sm },
  flex: { flex: 1 },
});
