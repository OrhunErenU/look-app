import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';

import { EmptyState, ErrorState, LoadingState } from '@/components/common/States';
import { ProfileView } from '@/components/profile/ProfileView';
import { useMe } from '@/features/auth/AuthProvider';
import { fetchProfileByUsername } from '@/features/profiles/api';
import type { Profile } from '@/types/database';
import { friendlyError } from '@/utils/errors';

export default function UserProfile() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const me = useMe();
  const [profile, setProfile] = useState<Profile | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    fetchProfileByUsername(username)
      .then(setProfile)
      .catch((e) => setError(friendlyError(e)));
  }, [username]);

  useEffect(load, [load]);

  useEffect(() => {
    // Kendi profiline başka bir yoldan gelindiğinde profil sekmesi açılır.
    if (profile && profile.id === me.id) router.replace('/profile');
  }, [profile, me.id]);

  return (
    <>
      <Stack.Screen options={{ title: profile ? `@${profile.username}` : '' }} />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : profile === undefined ? (
        <LoadingState />
      ) : profile === null ? (
        // Engellenen veya kapatılan hesaplar da burada "bulunamadı" olarak görünür.
        <EmptyState icon="person-outline" title="Kullanıcı bulunamadı" message="Bu hesap mevcut değil veya erişilemiyor." />
      ) : (
        <ProfileView profile={profile} onChanged={load} />
      )}
    </>
  );
}
