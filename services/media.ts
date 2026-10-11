import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import { supabase } from '@/services/supabase';
import { centerCrop, fitWithin, type AspectOption } from '@/utils/image';

export const POST_BUCKET = 'post-images';
export const AVATAR_BUCKET = 'avatars';

const FULL_EDGE = 1440;
const THUMB_EDGE = 480;
const SIGNED_URL_TTL = 60 * 60; // saniye

// İmzalı bağlantılar süresi dolmadan yeniden kullanılır. Görsel önbelleği
// bağlantı yerine depolama yolunu anahtar olarak kullanır (bkz. PostImage).
const signedCache = new Map<string, { url: string; expiresAt: number }>();

export async function signedUrls(paths: string[]): Promise<Record<string, string>> {
  const now = Date.now();
  const result: Record<string, string> = {};
  const missing: string[] = [];

  for (const path of new Set(paths)) {
    const cached = signedCache.get(path);
    if (cached && cached.expiresAt - now > 5 * 60 * 1000) result[path] = cached.url;
    else missing.push(path);
  }

  if (missing.length > 0) {
    const { data, error } = await supabase.storage.from(POST_BUCKET).createSignedUrls(missing, SIGNED_URL_TTL);
    if (error) throw error;
    for (const item of data ?? []) {
      if (item.signedUrl && item.path) {
        result[item.path] = item.signedUrl;
        signedCache.set(item.path, { url: item.signedUrl, expiresAt: now + SIGNED_URL_TTL * 1000 });
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
};

type Encoded = { uri: string; width: number; height: number };

// Düzenlemeleri uygular ve JPEG olarak yeniden kodlar. Yeniden kodlama EXIF ve
// konum bilgilerini fotoğraftan çıkarır.
async function encode(
  image: DraftImage,
  aspect: AspectOption,
  maxEdge: number,
  compress: number,
): Promise<Encoded> {
  const rotated = image.rotation % 180 !== 0;
  const w = rotated ? image.height : image.width;
  const h = rotated ? image.width : image.height;

  const context = ImageManipulator.manipulate(image.uri);
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
    await removePostFiles(uploaded.flatMap((u) => [u.storage_path, u.thumb_path]));
    throw error;
  }
}

export async function removePostFiles(paths: string[]) {
  if (paths.length === 0) return;
  await supabase.storage.from(POST_BUCKET).remove(paths).catch(() => {});
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
  await supabase.storage.from(AVATAR_BUCKET).remove([path]).catch(() => {});
}
