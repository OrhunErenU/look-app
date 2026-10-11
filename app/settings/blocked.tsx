import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList } from 'react-native';

import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { UserRow } from '@/components/profile/UserRow';
import { useMe } from '@/features/auth/AuthProvider';
import { fetchBlockedUsers, unblockUser } from '@/features/social/api';
import type { ProfileSummary } from '@/types/database';
import { friendlyError } from '@/utils/errors';

export default function Blocked() {
  const me = useMe();
  const [users, setUsers] = useState<ProfileSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchBlockedUsers()
      .then(setUsers)
      .catch((e) => setError(friendlyError(e)));
  }, []);

  useEffect(load, [load]);

  const unblock = async (user: ProfileSummary) => {
    try {
      await unblockUser(me.id, user.id);
      setUsers((prev) => prev?.filter((u) => u.id !== user.id) ?? null);
    } catch (e) {
      Alert.alert('İşlem tamamlanamadı', friendlyError(e));
    }
  };

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (users === null) return <LoadingState />;

  return (
    <FlatList
      data={users}
      keyExtractor={(u) => u.id}
      contentContainerStyle={{ flexGrow: 1 }}
      renderItem={({ item }) => (
        <UserRow
          user={item}
          disableNavigation
          right={<Button title="Engeli kaldır" compact variant="secondary" onPress={() => unblock(item)} />}
        />
      )}
      ListEmptyComponent={<EmptyState icon="ban-outline" title="Engellediğin hesap yok" />}
    />
  );
}
