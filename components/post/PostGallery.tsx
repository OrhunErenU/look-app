import { Image } from 'expo-image';
import { useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View, useWindowDimensions, type ViewToken } from 'react-native';

import { useTheme } from '@/hooks/useTheme';
import type { ResolvedImage } from '@/types/database';
import { displayAspect } from '@/utils/image';

// Kombin fotoğrafları kırpılmadan gösterilir; galeri ilk fotoğrafın oranını
// kullanır ve diğerleri bu alana sığdırılır.
export function PostGallery({
  images,
  width: widthProp,
  onDoubleTap,
}: {
  images: ResolvedImage[];
  width?: number;
  onDoubleTap?: () => void;
}) {
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const width = widthProp ?? window.width;
  const cover = images[0];
  const height = cover ? width / displayAspect(cover.width, cover.height) : width;
  const [index, setIndex] = useState(0);
  const lastTap = useRef(0);

  const handleTap = () => {
    const now = Date.now();
    if (now - lastTap.current < 280) onDoubleTap?.();
    lastTap.current = now;
  };

  // FlatList bu fonksiyonun değişmemesini bekler.
  const onViewable = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    const first = viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  return (
    <View>
      <FlatList
        data={images}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onViewableItemsChanged={onViewable}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index: i }) => (
          <Pressable
            style={{ width, height, backgroundColor: colors.skeleton }}
            onPress={handleTap}
            accessibilityRole="image"
            accessibilityLabel={`Kombin fotoğrafı ${i + 1} / ${images.length}`}
          >
            <Image
              source={{ uri: item.url, cacheKey: item.storage_path }}
              placeholder={{ uri: item.thumbUrl, cacheKey: item.thumb_path }}
              placeholderContentFit="contain"
              style={StyleSheet.absoluteFill}
              contentFit="contain"
              transition={200}
              recyclingKey={item.id}
            />
          </Pressable>
        )}
      />
      {images.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {images.map((image, i) => (
            <View
              key={image.id}
              style={[styles.dot, { backgroundColor: i === index ? colors.accent : colors.border }]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 5, paddingTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3 },
});
