import { useCallback, useEffect, useState } from 'react';
import { Alert, FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { UserRow } from '@/components/profile/UserRow';
import { spacing } from '@/constants/theme';
import { useAuth, useMe } from '@/features/auth/AuthProvider';
import { fetchFollowList, respondFollowRequest } from '@/features/profiles/api';
import type { ProfileSummary } from '@/types/database';
import { friendlyError } from '@/utils/errors';

// Gizli hesaplar için bekleyen takip istekleri.
export default function FollowRequests() {
  const me = useMe();
  const { refreshProfile } = useAuth();
  const [users, setUsers] = useState<ProfileSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchFollowList(me.id, 'requests')
      .then(setUsers)
      .catch((e) => setError(friendlyError(e)));
  }, [me.id]);

  useEffect(load, [load]);

  const respond = async (user: ProfileSummary, accept: boolean) => {
    try {
      await respondFollowRequest(user.id, accept);
      setUsers((prev) => prev?.filter((u) => u.id !== user.id) ?? null);
      if (accept) refreshProfile();
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
          right={
            <View style={styles.actions}>
              <Button title="Onayla" compact onPress={() => respond(item, true)} />
              <Button title="Sil" compact variant="secondary" onPress={() => respond(item, false)} />
            </View>
          }
        />
      )}
      ListEmptyComponent={
        <EmptyState icon="person-add-outline" title="Bekleyen istek yok" message="Gizli hesabını takip etmek isteyenler burada görünür." />
      }
    />
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: spacing.sm },
});
