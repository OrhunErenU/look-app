import { Text } from '@/components/common/Text';

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <Text
      accessibilityRole="header"
      accessibilityLabel="LOOK"
      style={{ fontSize: size, fontWeight: '800', letterSpacing: size * 0.18 }}
    >
      LOOK
    </Text>
  );
}
