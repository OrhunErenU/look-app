import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import type { ReactElement } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { palette } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import type { FeedPost } from '@/types/database';

const COLUMNS = 3;
const GAP = 2;

// Profil, keşfet ve kaydedilenler için kapak görseli ızgarası. Hücreler 3:4
// oranında tutarlı biçimde kırpılır.
export function PostGrid({
  posts,
  header,
  empty,
  refreshing,
  onRefresh,
  onEndReached,
  loadingMore,
}: {
  posts: FeedPost[];
  header?: ReactElement | null;
  empty?: ReactElement | null;
  refreshing?: boolean;
  onRefresh?: () => void;
  onEndReached?: () => void;
  loadingMore?: boolean;
}) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const size = (width - GAP * (COLUMNS - 1)) / COLUMNS;

  return (
    <FlatList
      data={posts}
      numColumns={COLUMNS}
      keyExtractor={(item) => item.id}
      ListHeaderComponent={header}
      ListEmptyComponent={empty}
      columnWrapperStyle={posts.length > 0 ? { gap: GAP } : undefined}
      contentContainerStyle={{ gap: GAP, flexGrow: 1 }}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      refreshControl={
        onRefresh ? (
          <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.textSecondary} />
        ) : undefined
      }
      ListFooterComponent={loadingMore ? <ActivityIndicator style={styles.footer} color={colors.textSecondary} /> : null}
      initialNumToRender={12}
      windowSize={7}
      removeClippedSubviews
      renderItem={({ item }) => {
        const cover = item.images[0];
        return (
          <Pressable
            onPress={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
            style={{ width: size, height: size * (4 / 3), backgroundColor: colors.skeleton }}
            accessibilityRole="button"
            accessibilityLabel={item.title ? `${item.title}, ${item.author.username}` : `${item.author.username} kombini`}
          >
            <Image
              source={{ uri: cover.thumbUrl, cacheKey: cover.thumb_path }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              transition={150}
              recyclingKey={item.id}
            />
            {item.images.length > 1 ? (
              <Ionicons name="copy-outline" size={16} color={palette.dark.text} style={styles.multi} />
            ) : null}
            {item.pinned_at ? (
              <Ionicons name="pin" size={14} color={palette.dark.text} style={styles.pin} />
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  multi: { position: 'absolute', top: 6, right: 6, opacity: 0.9 },
  pin: { position: 'absolute', top: 6, left: 6, opacity: 0.9 },
  footer: { paddingVertical: 24 },
});
