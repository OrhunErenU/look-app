import { StyleSheet, View } from 'react-native';

import { Chip } from '@/components/common/Chip';
import { Text } from '@/components/common/Text';
import { spacing } from '@/constants/theme';
import { useStyles } from '@/features/posts/useStyles';
import type { TagKind } from '@/types/database';

const KIND_LABELS: Record<TagKind, string> = {
  style: 'Stil',
  season: 'Mevsim',
  occasion: 'Kullanım alanı',
};

// Etiket seçici. `kinds` verilirse yalnızca o türler, birden fazla tür varsa
// başlıklarla gruplanmış olarak gösterilir.
export function StylePicker({
  selected,
  onChange,
  max,
  exclude = [],
  kinds = ['style'],
}: {
  selected: string[];
  onChange: (slugs: string[]) => void;
  max?: number;
  exclude?: string[];
  kinds?: TagKind[];
}) {
  const { styles: options, error } = useStyles();

  const toggle = (slug: string) => {
    if (selected.includes(slug)) onChange(selected.filter((s) => s !== slug));
    else if (!max || selected.length < max) onChange([...selected, slug]);
  };

  if (error) {
    return (
      <Text variant="caption" tone="secondary">
        Etiket listesi yüklenemedi.
      </Text>
    );
  }

  return (
    <View style={styles.groups}>
      {kinds.map((kind) => (
        <View key={kind} style={styles.group}>
          {kinds.length > 1 ? (
            <Text variant="small" tone="secondary">
              {KIND_LABELS[kind]}
            </Text>
          ) : null}
          <View style={styles.wrap}>
            {options
              .filter((o) => o.kind === kind && !exclude.includes(o.slug))
              .map((o) => (
                <Chip key={o.slug} label={o.name} selected={selected.includes(o.slug)} onPress={() => toggle(o.slug)} />
              ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groups: { gap: spacing.md },
  group: { gap: spacing.xs },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
