import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/common/Chip';
import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useStyles } from '@/features/posts/useStyles';

export function StylePicker({
  selected,
  onChange,
  max,
  exclude = [],
}: {
  selected: string[];
  onChange: (slugs: string[]) => void;
  max?: number;
  exclude?: string[];
}) {
  const { styles: options, error } = useStyles();

  const toggle = (slug: string) => {
    if (selected.includes(slug)) onChange(selected.filter((s) => s !== slug));
    else if (!max || selected.length < max) onChange([...selected, slug]);
  };

  if (error) {
    return (
      <Text variant="caption" tone="secondary">
        Stil listesi yüklenemedi.
      </Text>
    );
  }

  return (
    <View style={styles.wrap}>
      {options
        .filter((o) => !exclude.includes(o.slug))
        .map((o) => (
          <Chip key={o.slug} label={o.name} selected={selected.includes(o.slug)} onPress={() => toggle(o.slug)} />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
