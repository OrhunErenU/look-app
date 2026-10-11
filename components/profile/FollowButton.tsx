import { useState } from 'react';
import { Alert } from 'react-native';

import { Button } from '@/components/common/Button';
import { follow, unfollow } from '@/features/profiles/api';
import type { FollowStatus } from '@/types/database';
import { friendlyError } from '@/utils/errors';

export function FollowButton({
  viewerId,
  targetId,
  status,
  onChange,
  compact = true,
}: {
  viewerId: string;
  targetId: string;
  status: FollowStatus | null;
  onChange: (status: FollowStatus | null) => void;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);

  const press = async () => {
    setBusy(true);
    try {
      if (status) {
        await unfollow(viewerId, targetId);
        onChange(null);
      } else {
        onChange(await follow(targetId));
      }
    } catch (e) {
      Alert.alert('İşlem tamamlanamadı', friendlyError(e));
    } finally {
      setBusy(false);
    }
  };

  const title = status === 'accepted' ? 'Takiptesin' : status === 'pending' ? 'İstek gönderildi' : 'Takip et';
  return (
    <Button
      title={title}
      onPress={press}
      loading={busy}
      compact={compact}
      variant={status ? 'secondary' : 'primary'}
      accessibilityLabel={status ? `${title}. Takibi bırakmak için dokun.` : 'Takip et'}
    />
  );
}
