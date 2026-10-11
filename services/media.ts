import { Image } from 'expo-image';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/services/supabase';
import { centerCrop, fitWithin, type AspectOption } from '@/utils/image';

export const POST_BUCKET = 'post-images';
export const AVATAR_BUCKET = 'avatars';
export const WARDROBE_BUCKET = 'wardrobe';

type PrivateBucket = typeof POST_BUCKET | typeof WARDROBE_BUCKET;

const FULL_EDGE = 1440;
const THUMB_EDGE = 480;
const SIGNED_URL_TTL = 60 * 60; // saniye

// İmzalı bağlantılar süresi dolmadan yeniden kullanılır. Görsel önbelleği
// bağlantı yerine depolama yolunu anahtar olarak kullanır (bkz. PostGallery).
const signedCache = new Map<string, { url: string; expiresAt: number }>();

export async function signedUrls(
  paths: string[],
  bucket: PrivateBucket = POST_BUCKET,
): Promise<Record<string, string>> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const path of new Set(paths)) {
    const cached = signedCache.get(`${bucket}:${path}`);
    if (cached && cached.expiresAt - now > 5 * 60 * 1000) result[path] = cached.url;
    else missing.push(path);
  }

  if (missing.length > 0) {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(missing, SIGNED_URL_TTL);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) {
        result[item.path] = item.signedUrl;
        signedCache.set(`${bucket}:${item.path}`, { url: item.signedUrl, expiresAt: now + SIGNED_URL_TTL * 1000 });
      }
    }
  }
  return result;
}

export function avatarUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path).data.publicUrl;
}

export type DraftImage = {
  key: string;
  uri: string;
  width: number;
  height: number;
  rotation: 0 | 90 | 180 | 270;
  // Gardıroptaki bir parçanın fotoğrafı kullanılıyorsa depolama yolu.
  // Taslak saklandığında süresi dolabilecek bağlantı yerine yol tutulur.
  wardrobePath?: string;
};

type Encoded = { uri: string; width: number; height: number };

async function loadSource(image: DraftImage) {
  if (!image.wardrobePath) return { source: image.uri, width: image.width, height: image.height };
  const urls = await signedUrls([image.wardrobePath], WARDROBE_BUCKET);
  const url = urls[image.wardrobePath];
  if (!url) throw new Error('Gardırop fotoğrafı yüklenemedi.');
  const ref = await Image.loadAsync(url);
  return { source: ref, width: ref.width, height: ref.height };
}

// Düzenlemeleri uygular ve JPEG olarak yeniden kodlar. Yeniden kodlama EXIF ve
// konum bilgilerini fotoğraftan çıkarır.
async function encode(
  image: DraftImage,
  aspect: AspectOption,
  maxEdge: number,
  compress: number,
): Promise<Encoded> {
  const { source, width, height } = await loadSource(image);
  const rotated = image.rotation % 180 !== 0;
  const w = rotated ? height : width;
  const h = rotated ? width : height;

  const context = ImageManipulator.manipulate(source);
  if (image.rotation) context.rotate(image.rotation);
  const crop = centerCrop(w, h, aspect);
  if (crop) context.crop(crop);
  const size = fitWithin(crop?.width ?? w, crop?.height ?? h, maxEdge);
  context.resize(size);

  const ref = await context.renderAsync();
  const saved = await ref.saveAsync({ compress, format: SaveFormat.JPEG });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

async function uploadFile(bucket: string, path: string, uri: string, upsert = false) {
  const body = await (await fetch(uri)).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, body, {
    contentType: 'image/jpeg',
    cacheControl: '31536000',
    upsert,
  });
  if (error) throw error;
}

export type UploadedImage = {
  storage_path: string;
  thumb_path: string;
  width: number;
  height: number;
};

export async function uploadPostImages(
  userId: string,
  postId: string,
  images: DraftImage[],
  aspect: AspectOption,
  onProgress?: (done: number, total: number) => void,
): Promise<UploadedImage[]> {
  const uploaded: UploadedImage[] = [];
  const total = images.length * 2;
  let done = 0;
  try {
    for (const [index, image] of images.entries()) {
      const full = await encode(image, aspect, FULL_EDGE, 0.85);
      const thumb = await encode(image, aspect, THUMB_EDGE, 0.7);
      const base = `${userId}/${postId}/${index}`;
      await uploadFile(POST_BUCKET, `${base}.jpg`, full.uri);
      onProgress?.(++done, total);
      await uploadFile(POST_BUCKET, `${base}_t.jpg`, thumb.uri);
      onProgress?.(++done, total);
      uploaded.push({
        storage_path: `${base}.jpg`,
        thumb_path: `${base}_t.jpg`,
        width: full.width,
        height: full.height,
      });
    }
    return uploaded;
  } catch (error) {
    await removeFiles(POST_BUCKET, uploaded.flatMap((u) => [u.storage_path, u.thumb_path]));
    throw error;
  }
}

export async function removeFiles(bucket: string, paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(bucket).remove(paths).catch(() => {});
}

export function removePostFiles(paths: string[]) {
  return removeFiles(POST_BUCKET, paths);
}

// Gardırop parçası fotoğrafı. Her yüklemede yeni dosya adı kullanılır; eski
// dosya kayıt güncellendikten sonra silinir.
export async function uploadWardrobePhoto(
  userId: string,
  itemId: string,
  uri: string,
  width: number,
  height: number,
): Promise<{ photo_path: string; thumb_path: string }> {
  const draft: DraftImage = { key: itemId, uri, width, height, rotation: 0 };
  const full = await encode(draft, 'original', 1080, 0.85);
  const thumb = await encode(draft, 'original', 360, 0.7);
  const base = `${userId}/${itemId}-${Date.now()}`;
  await uploadFile(WARDROBE_BUCKET, `${base}.jpg`, full.uri);
  try {
    await uploadFile(WARDROBE_BUCKET, `${base}_t.jpg`, thumb.uri);
  } catch (error) {
    await removeFiles(WARDROBE_BUCKET, [`${base}.jpg`]);
    throw error;
  }
  return { photo_path: `${base}.jpg`, thumb_path: `${base}_t.jpg` };
}

export async function uploadAvatar(userId: string, uri: string, width: number, height: number) {
  const draft: DraftImage = { key: 'avatar', uri, width, height, rotation: 0 };
  const encoded = await encode(draft, '1:1', 512, 0.8);
  // Her yüklemede yeni yol kullanılır; böylece önbellekteki eski görsel gösterilmez.
  const path = `${userId}/${Date.now()}.jpg`;
  await uploadFile(AVATAR_BUCKET, path, encoded.uri);
  return path;
}

export async function removeAvatar(path: string | null) {
  if (!path) return;
  await removeFiles(AVATAR_BUCKET, [path]);
}
