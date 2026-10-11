import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/common/IconButton';
import { Text } from '@/components/common/Text';
import { TopBar } from '@/components/common/TopBar';
import { ProfileView } from '@/components/profile/ProfileView';
import { useAuth, useMe } from '@/features/auth/AuthProvider';
import { useTheme } from '@/hooks/useTheme';

export default function MyProfile() {
  const me = useMe();
  const { refreshProfile } = useAuth();
  const { colors } = useTheme();

  // Sayaçlar (takipçi, kombin) sekmeye her dönüşte güncellenir.
  useFocusEffect(
    useCallback(() => {
      refreshProfile();
    }, [refreshProfile]),
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: colors.background }}>
      <TopBar
        left={<Text variant="title">@{me.username}</Text>}
        right={
          <>
            {me.is_private ? (
              <IconButton name="person-add-outline" label="Takip istekleri" onPress={() => router.push('/follow-requests')} />
            ) : null}
            <IconButton name="settings-outline" label="Ayarlar" onPress={() => router.push('/settings')} />
          </>
        }
      />
      <ProfileView profile={me} />
    </SafeAreaView>
  );
}
