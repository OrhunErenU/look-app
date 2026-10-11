import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/common/Text';
import { useTheme } from '@/hooks/useTheme';
import { avatarUrl } from '@/services/media';

// Profil fotoğrafı yoksa kullanıcı adının baş harfi gösterilir.
export function Avatar({
  path,
  username,
  size = 36,
}: {
  path: string | null | undefined;
  username: string;
  size?: number;
}) {
  const { colors } = useTheme();
  const uri = avatarUrl(path);
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[shape, { backgroundColor: colors.skeleton }]}
        contentFit="cover"
        transition={150}
        accessibilityLabel={`${username} profil fotoğrafı`}
      />
    );
  }
  return (
    <View style={[shape, styles.fallback, { backgroundColor: colors.border }]}>
      <Text style={{ fontSize: size * 0.4, fontWeight: '600' }} tone="secondary">
        {username.charAt(0).toLocaleUpperCase('tr-TR')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: { alignItems: 'center', justifyContent: 'center' },
});
