import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Segmented } from '@/components/common/Segmented';
import { EmptyState, LoadingState } from '@/components/common/States';
import { Text } from '@/components/common/Text';
import { CollectionGrid } from '@/components/collection/CollectionGrid';
import { PostGrid } from '@/components/post/PostGrid';
import { UserRow } from '@/components/profile/UserRow';
import { radius, spacing, typography } from '@/constants/theme';
import { searchCollections } from '@/features/collections/api';
import { searchPosts } from '@/features/posts/api';
import { useStyles } from '@/features/posts/useStyles';
import { searchProfiles } from '@/features/profiles/api';
import { useTheme } from '@/hooks/useTheme';
import type { Collection, FeedPost, Profile, Style } from '@/types/database';

type Tab = 'people' | 'outfits' | 'collections';
type Row = { kind: 'style'; style: Style } | { kind: 'user'; user: Profile };

const TABS: { value: Tab; label: string }[] = [
  { value: 'people', label: 'Kişiler ve etiketler' },
  { value: 'outfits', label: 'Kombinler' },
  { value: 'collections', label: 'Koleksiyonlar' },
];

// Bir değeri, kullanıcı yazmayı bıraktıktan kısa süre sonra günceller.
function useDebounced(value: string, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

function useSearch<T>(term: string, enabled: boolean, run: (q: string) => Promise<T[]>, minLength = 1) {
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!enabled || term.length < minLength) {
      setResults([]);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    run(term)
      .then((r) => active && setResults(r))
      .catch(() => active && setResults([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
    // run sabit modül fonksiyonudur.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term, enabled, minLength]);
  return { results, loading };
}

// Kullanıcı adı, görünen ad, stil etiketi, kombin başlığı ve herkese açık
// koleksiyon adıyla arama.
export default function Search() {
  const { colors } = useTheme();
  const { styles: allStyles } = useStyles();
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('people');
  const term = useDebounced(query.trim());

  const users = useSearch<Profile>(term, tab === 'people', searchProfiles);
  const posts = useSearch<FeedPost>(term, tab === 'outfits', searchPosts, 2);
  const collections = useSearch<Collection>(term, tab === 'collections', searchCollections, 2);

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
      ...users.results.map((user) => ({ kind: 'user' as const, user })),
    ];
  }, [term, allStyles, users.results]);

  const empty = <EmptyState icon="search-outline" title="Sonuç bulunamadı" />;

  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]}>
      <View style={[styles.searchBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search" size={18} color={colors.textSecondary} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Kullanıcı, kombin veya stil ara"
          placeholderTextColor={colors.textSecondary}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel="Ara"
          style={[styles.flex, typography.body, { color: colors.text }]}
        />
      </View>
      <View style={styles.tabs}>
        <Segmented options={TABS} value={tab} onChange={setTab} />
      </View>

      {!term ? (
        <EmptyState
          icon="search-outline"
          title="Ara"
          message="@kullanıcıadı, isim, “streetwear” gibi stiller, kombin başlıkları veya herkese açık koleksiyonlar."
        />
      ) : tab === 'people' ? (
        users.loading && rows.length === 0 ? (
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
                      {item.style.kind === 'season' ? 'Mevsim' : item.style.kind === 'occasion' ? 'Kullanım alanı' : 'Stil'}
                    </Text>
                  </View>
                </Pressable>
              ) : (
                <UserRow user={item.user} subtitle={item.user.is_private ? 'Gizli hesap' : undefined} />
              )
            }
            ListEmptyComponent={empty}
          />
        )
      ) : tab === 'outfits' ? (
        posts.loading ? <LoadingState /> : <PostGrid posts={posts.results} empty={empty} />
      ) : collections.loading ? (
        <LoadingState />
      ) : (
        <CollectionGrid collections={collections.results} empty={empty} />
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
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    paddingHorizontal: spacing.md,
    minHeight: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
  tabs: { padding: spacing.lg },
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
