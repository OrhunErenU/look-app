import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/common/Button';
import { Screen } from '@/components/common/Screen';
import { Text } from '@/components/common/Text';
import { TextField } from '@/components/common/TextField';
import { spacing } from '@/constants/theme';
import { useMe } from '@/features/auth/AuthProvider';
import { REPORT_REASONS, submitReport } from '@/features/social/api';
import { useTheme } from '@/hooks/useTheme';
import type { ReportReason } from '@/types/database';
import { friendlyError } from '@/utils/errors';

export default function Report() {
  const { postId, commentId, userId } = useLocalSearchParams<{ postId?: string; commentId?: string; userId?: string }>();
  const me = useMe();
  const { colors } = useTheme();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const target = commentId ? 'yorumu' : postId ? 'kombini' : 'hesabı';

  const submit = async () => {
    if (!reason) {
      setError('Bir neden seç.');
      return;
    }
    setSending(true);
    setError(null);
    try {
      await submitReport({ reporterId: me.id, reason, details, postId, commentId, userId });
      setSent(true);
    } catch (e) {
      setError(friendlyError(e));
    } finally {
      setSending(false);
    }
  };

  if (sent) {
    return (
      <Screen edges={['bottom']}>
        <Ionicons name="checkmark-circle-outline" size={48} color={colors.success} />
        <Text variant="title">Şikâyetin alındı</Text>
        <Text tone="secondary">
          Ekibimiz inceleyecek. Şikâyet eden kişinin kimliği karşı tarafla paylaşılmaz. Bu kişiyle etkileşimi kesmek
          istersen profilinden engelleyebilirsin.
        </Text>
        <Button title="Kapat" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Text variant="title">Bu {target} neden şikâyet ediyorsun?</Text>
      <View>
        {REPORT_REASONS.map((r) => (
          <Pressable
            key={r.value}
            style={[styles.option, { borderBottomColor: colors.border }]}
            onPress={() => setReason(r.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected: reason === r.value }}
          >
            <Text style={styles.flex}>{r.label}</Text>
            <Ionicons
              name={reason === r.value ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color={reason === r.value ? colors.accent : colors.textSecondary}
            />
          </Pressable>
        ))}
      </View>
      <TextField label="Ek bilgi (isteğe bağlı)" value={details} onChangeText={setDetails} multiline maxLength={1000} />
      {error ? <Text tone="danger">{error}</Text> : null}
      <Button title="Gönder" onPress={submit} loading={sending} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, gap: spacing.md },
  flex: { flex: 1 },
});
