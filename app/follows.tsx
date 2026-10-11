import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList } from 'react-native';

import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { UserRow } from '@/components/profile/UserRow';
import { useMe } from '@/features/auth/AuthProvider';
import { fetchFollowList, removeFollower } from '@/features/profiles/api';
import type { ProfileSummary } from '@/types/database';
import { friendlyError } from '@/utils/errors';

export default function Follows() {
  const { userId, kind, username } = useLocalSearchParams<{
    userId: string;
    kind: 'followers' | 'following';
    username: string;
  }>();
  const me = useMe();
  const [users, setUsers] = useState<ProfileSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchFollowList(userId, kind)
      .then(setUsers)
      .catch((e) => setError(friendlyError(e)));
  }, [userId, kind]);

  useEffect(load, [load]);

  const remove = (user: ProfileSummary) =>
    Alert.alert('Takipçiyi çıkar', `@${user.username} artık seni takip etmeyecek.`, [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkar',
        style: 'destructive',
        onPress: async () => {
          try {
            await removeFollower(me.id, user.id);
            setUsers((prev) => prev?.filter((u) => u.id !== user.id) ?? null);
          } catch (e) {
            Alert.alert('İşlem tamamlanamadı', friendlyError(e));
          }
        },
      },
    ]);

  const title = kind === 'followers' ? 'Takipçiler' : 'Takip edilenler';
  const ownFollowers = userId === me.id && kind === 'followers';

  return (
    <>
      <Stack.Screen options={{ title: username ? `${title} · @${username}` : title }} />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : users === null ? (
        <LoadingState />
      ) : (
        <FlatList
          data={users}
          keyExtractor={(u) => u.id}
          contentContainerStyle={{ flexGrow: 1 }}
          renderItem={({ item }) => (
            <UserRow
              user={item}
              right={ownFollowers ? <Button title="Çıkar" variant="secondary" compact onPress={() => remove(item)} /> : undefined}
            />
          )}
          ListEmptyComponent={<EmptyState icon="people-outline" title="Liste boş" />}
        />
      )}
    </>
  );
}
