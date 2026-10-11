import { randomUUID } from 'expo-crypto';

import { currentUserId } from '@/features/posts/api';
import { WARDROBE_BUCKET, removeFiles, signedUrls, uploadWardrobePhoto } from '@/services/media';
import { supabase } from '@/services/supabase';
import type { ResolvedItem, Season, WardrobeCategory, WardrobeItem } from '@/types/database';

export const CATEGORIES: { value: WardrobeCategory; label: string }[] = [
  { value: 'top', label: 'Üst giyim' },
  { value: 'bottom', label: 'Alt giyim' },
  { value: 'outerwear', label: 'Dış giyim' },
  { value: 'shoes', label: 'Ayakkabı' },
  { value: 'bag', label: 'Çanta' },
  { value: 'accessory', label: 'Aksesuar' },
  { value: 'one_piece', label: 'Takım / tek parça' },
];

export const CATEGORY_LABELS = Object.fromEntries(CATEGORIES.map((c) => [c.value, c.label])) as Record<
  WardrobeCategory,
  string
>;

export const SEASONS: { value: Season; label: string }[] = [
  { value: 'spring', label: 'İlkbahar' },
  { value: 'summer', label: 'Yaz' },
  { value: 'autumn', label: 'Sonbahar' },
  { value: 'winter', label: 'Kış' },
];

async function resolve(items: WardrobeItem[]): Promise<ResolvedItem[]> {
  const paths = items.flatMap((i) => (i.thumb_path && i.photo_path ? [i.thumb_path, i.photo_path] : []));
  const urls = paths.length ? await signedUrls(paths, WARDROBE_BUCKET) : {};
  return items.map((i) => ({
    ...i,
    photoUrl: i.photo_path ? (urls[i.photo_path] ?? null) : null,
    thumbUrl: i.thumb_path ? (urls[i.thumb_path] ?? null) : null,
  }));
}

export async function fetchWardrobe(filter: {
  category?: WardrobeCategory | null;
  status?: 'active' | 'archived';
}): Promise<ResolvedItem[]> {
  const userId = await currentUserId();
  let query = supabase
    .from('wardrobe_items')
    .select('*')
    .eq('user_id', userId)
    .eq('status', filter.status ?? 'active')
    .order('created_at', { ascending: false })
    .limit(500);
  if (filter.category) query = query.eq('category', filter.category);
  const { data, error } = await query;
  if (error) throw error;
  return resolve(data as WardrobeItem[]);
}

export async function fetchItemsByIds(ids: string[]): Promise<ResolvedItem[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('wardrobe_items').select('*').in('id', ids);
  if (error) throw error;
  const items = await resolve(data as WardrobeItem[]);
  // Seçim sırası korunur.
  return ids.flatMap((id) => items.filter((i) => i.id === id));
}

export async function fetchItem(id: string): Promise<ResolvedItem | null> {
  const { data, error } = await supabase.from('wardrobe_items').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [item] = await resolve([data as WardrobeItem]);
  return item;
}

export async function fetchItemIdsForPost(postId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('post_items')
    .select('item_id, position')
    .eq('post_id', postId)
    .order('position');
  if (error) throw error;
  return data.map((r) => r.item_id as string);
}

export type ItemInput = {
  name: string;
  category: WardrobeCategory;
  color: string;
  styleId: number | null;
  seasons: Season[];
  brand: string;
  purchasePrice: string;
  purchaseDate: string | null;
  notes: string;
  status: 'active' | 'archived';
};

export type NewPhoto = { uri: string; width: number; height: number };

function toRow(input: ItemInput) {
  const price = input.purchasePrice.trim().replace(',', '.');
  return {
    name: input.name.trim(),
    category: input.category,
    color: input.color.trim() || null,
    style_id: input.styleId,
    seasons: input.seasons,
    brand: input.brand.trim() || null,
    purchase_price: price ? Number(price) : null,
    purchase_date: input.purchaseDate,
    notes: input.notes.trim() || null,
    status: input.status,
  };
}

export async function saveItem(
  existing: WardrobeItem | null,
  input: ItemInput,
  photo: NewPhoto | null,
): Promise<string> {
  const userId = await currentUserId();
  const id = existing?.id ?? randomUUID();
  const uploaded = photo ? await uploadWardrobePhoto(userId, id, photo.uri, photo.width, photo.height) : null;

  const row = { ...toRow(input), ...(uploaded ?? {}) };
  const { error } = existing
    ? await supabase.from('wardrobe_items').update(row).eq('id', id)
    : await supabase.from('wardrobe_items').insert({ ...row, id, user_id: userId });

  if (error) {
    if (uploaded) await removeFiles(WARDROBE_BUCKET, [uploaded.photo_path, uploaded.thumb_path]);
    throw error;
  }
  // Fotoğraf değiştiyse eski dosyalar silinir.
  if (uploaded && existing?.photo_path && existing.thumb_path) {
    await removeFiles(WARDROBE_BUCKET, [existing.photo_path, existing.thumb_path]);
  }
  return id;
}

export async function setItemStatus(id: string, status: 'active' | 'archived') {
  const { error } = await supabase.from('wardrobe_items').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteItem(item: WardrobeItem) {
  const { error } = await supabase.from('wardrobe_items').delete().eq('id', item.id);
  if (error) throw error;
  if (item.photo_path && item.thumb_path) {
    await removeFiles(WARDROBE_BUCKET, [item.photo_path, item.thumb_path]);
  }
}
