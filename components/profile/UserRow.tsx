import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import type { ProfileSummary } from '@/types/database';

export function UserRow({
  user,
  right,
  subtitle,
  disableNavigation = false,
}: {
  user: ProfileSummary;
  right?: ReactNode;
  subtitle?: string;
  disableNavigation?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.main}
        disabled={disableNavigation}
        onPress={() => router.push({ pathname: '/user/[username]', params: { username: user.username } })}
        accessibilityRole="link"
        accessibilityLabel={`${user.username} profili`}
      >
        <Avatar path={user.avatar_path} username={user.username} size={44} />
        <View style={styles.text}>
          <Text variant="username" numberOfLines={1}>
            {user.username}
          </Text>
          {subtitle || user.display_name ? (
            <Text variant="caption" tone="secondary" numberOfLines={1}>
              {subtitle ?? user.display_name}
            </Text>
          ) : null}
        </View>
      </Pressable>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.md,
  },
  main: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  text: { flex: 1 },
});
