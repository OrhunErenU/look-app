import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/common/Avatar';
import { Text } from '@/components/common/Text';
import { FollowButton } from '@/components/profile/FollowButton';
import { radius, spacing } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { suggestedProfiles } from '@/features/profiles/api';
import { useTheme } from '@/hooks/useTheme';
import type { FollowStatus, Profile } from '@/types/database';

// Keşfet ekranının üstündeki yatay kullanıcı önerileri.
export function SuggestedUsers() {
  const me = useMe();
  const { colors } = useTheme();
  const [users, setUsers] = useState<Profile[]>([]);
  const [status, setStatus] = useState<Record<string, FollowStatus | null>>({});

  useEffect(() => {
    suggestedProfiles().then(setUsers).catch(() => {});
  }, []);

  if (users.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text variant="subtitle" style={styles.title}>
        Önerilen kişiler
      </Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {users.map((user) => (
          <View key={user.id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.surface }]}>
            <Pressable
              style={styles.cardMain}
              onPress={() => router.push({ pathname: '/user/[username]', params: { username: user.username } })}
              accessibilityRole="link"
              accessibilityLabel={`${user.username} profili`}
            >
              <Avatar path={user.avatar_path} username={user.username} size={56} />
              <Text variant="username" numberOfLines={1}>
                {user.username}
              </Text>
              <Text variant="small" tone="secondary" numberOfLines={1}>
                {user.post_count} kombin
              </Text>
            </Pressable>
            <FollowButton
              viewerId={me.id}
              targetId={user.id}
              status={status[user.id] ?? null}
              onChange={(s) => setStatus((prev) => ({ ...prev, [user.id]: s }))}
            />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingBottom: spacing.md },
  title: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  row: { paddingHorizontal: spacing.lg, gap: spacing.md },
  card: {
    width: 140,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
  },
  cardMain: { alignItems: 'center', gap: spacing.xs },
});
