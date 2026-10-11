import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { EmptyState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { UserRow } from '@/components/profile/UserRow';
import { radius, spacing, typography } from '@/constants/theme';
import { useStyles } from '@/features/posts/useStyles';
import { searchProfiles } from '@/features/profiles/api';
import { useTheme } from '@/hooks/useTheme';
import type { Profile, Style } from '@/types/database';

type Row = { kind: 'style'; style: Style } | { kind: 'user'; user: Profile };

// Kullanıcı adı, görünen ad ve stil etiketiyle arama.
export default function Search() {
  const { colors } = useTheme();
  const { styles: allStyles } = useStyles();
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);

  const term = query.trim();

  useEffect(() => {
    if (!term) {
      setUsers([]);
      return;
    }
    let active = true;
    setLoading(true);
    // Her tuş vuruşunda istek atılmaz.
    const timer = setTimeout(() => {
      searchProfiles(term)
        .then((r) => active && setUsers(r))
        .catch(() => active && setUsers([]))
        .finally(() => active && setLoading(false));
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [term]);

  const rows = useMemo<Row[]>(() => {
    if (!term) return [];
    const normalized = term.replace(/^[#@]/, '').toLocaleLowerCase('tr-TR');
    const styleMatches = term.startsWith('@')
      ? []
      : allStyles.filter(
          (s) => s.slug.includes(normalized.replace(/\s+/g, '-')) || s.name.toLocaleLowerCase('tr-TR').includes(normalized),
        );
    return [
      ...styleMatches.map((style) => ({ kind: 'style' as const, style })),
      ...users.map((user) => ({ kind: 'user' as const, user })),
    ];
  }, [term, allStyles, users]);

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Kullanıcı veya stil ara"
          placeholderTextColor={colors.textSecondary}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Ara"
          style={[styles.flex, typography.body, { color: colors.text }]}
        />
      </View>
      {!term ? (
        <EmptyState icon="search-outline" title="Ara" message="@kullanıcıadı, isim veya streetwear, minimal gibi stil adları." />
      ) : loading && rows.length === 0 ? (
        <LoadingState />
      ) : (
        <FlatList
          data={rows}
          keyboardShouldPersistTaps="handled"
          keyExtractor={(row) => (row.kind === 'style' ? `s-${row.style.slug}` : `u-${row.user.id}`)}
          renderItem={({ item }) =>
            item.kind === 'style' ? (
              <Pressable
                style={styles.styleRow}
                onPress={() => router.push({ pathname: '/style/[slug]', params: { slug: item.style.slug } })}
                accessibilityRole="link"
              >
                <View style={[styles.tagIcon, { borderColor: colors.border }]}>
                  <Text variant="subtitle">#</Text>
                </View>
                <View>
                  <Text variant="username">{item.style.name}</Text>
                  <Text variant="caption" tone="secondary">
                    Stil
                  </Text>
                </View>
              </Pressable>
            ) : (
              <UserRow user={item.user} subtitle={item.user.is_private ? 'Gizli hesap' : undefined} />
            )
          }
          ListEmptyComponent={<EmptyState icon="search-outline" title="Sonuç bulunamadı" />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    margin: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  styleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  tagIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
