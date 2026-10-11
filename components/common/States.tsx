import type { ComponentProps } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { Button } from '@/components/common/Button';
import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

// Her ekran yüklenme, boş veri ve hata durumları için bu bileşenleri kullanır.

export function LoadingState() {
  const { colors } = useTheme();
  return (
    <View style={styles.center} accessibilityLabel="Yükleniyor">
      <ActivityIndicator color={colors.textSecondary} />
    </View>
  );
}

export function EmptyState({
  icon,
  title,
  message,
  actionTitle,
  onAction,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  message?: string;
  actionTitle?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.center}>
      <Ionicons name={icon} size={40} color={colors.textSecondary} />
      <Text variant="subtitle" style={styles.title}>
        {title}
      </Text>
      {message ? (
        <Text variant="caption" tone="secondary" style={styles.message}>
          {message}
        </Text>
      ) : null}
      {actionTitle && onAction ? (
        <Button title={actionTitle} onPress={onAction} compact style={styles.action} />
      ) : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      icon="cloud-offline-outline"
      title="Yüklenemedi"
      message={message}
      actionTitle={onRetry ? 'Tekrar dene' : undefined}
      onAction={onRetry}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.sm,
    minHeight: 280,
  },
  title: { textAlign: 'center', marginTop: spacing.sm },
  message: { textAlign: 'center', maxWidth: 300 },
  action: { marginTop: spacing.md },
});
