import { currentUserId } from '@/features/posts/api';
import { signedUrls } from '@/services/media';
import { supabase } from '@/services/supabase';
import type { Collection, CollectionVisibility } from '@/types/database';

export const COLLECTION_VISIBILITY: { value: CollectionVisibility; label: string }[] = [
  { value: 'private', label: 'Yalnızca ben' },
  { value: 'followers', label: 'Takipçiler' },
  { value: 'public', label: 'Herkese açık' },
];

type RawCollection = Collection & {
  collection_posts: { post: { images: { thumb_path: string; position: number }[] } | null }[];
};

const SELECT = `*, collection_posts(added_at, post:posts(images:post_images(thumb_path, position)))`;

async function withCovers(rows: RawCollection[]): Promise<Collection[]> {
  const covers = rows.map((r) => {
    const images = r.collection_posts[0]?.post?.images ?? [];
    return [...images].sort((a, b) => a.position - b.position)[0]?.thumb_path ?? null;
  });
  const paths = covers.filter((c): c is string => Boolean(c));
  const urls = paths.length ? await signedUrls(paths) : {};
  return rows.map(({ collection_posts: _, ...c }, i) => ({
    ...c,
    coverKey: covers[i],
    coverUrl: covers[i] ? (urls[covers[i]!] ?? null) : null,
  }));
}

export async function fetchCollections(userId: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .from('collections')
    .select(SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
    .order('added_at', { referencedTable: 'collection_posts', ascending: false })
    .limit(1, { referencedTable: 'collection_posts' });
  if (error) throw error;
  return withCovers(data as unknown as RawCollection[]);
}

export async function fetchCollection(id: string): Promise<Collection | null> {
  const { data, error } = await supabase.from('collections').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Collection | null;
}

export async function searchCollections(query: string): Promise<Collection[]> {
  const { data, error } = await supabase
    .rpc('search_collections', { p_query: query, p_limit: 20 })
    .select(SELECT)
    .order('added_at', { referencedTable: 'collection_posts', ascending: false })
    .limit(1, { referencedTable: 'collection_posts' });
  if (error) throw error;
  return withCovers(data as unknown as RawCollection[]);
}

export async function saveCollection(
  id: string | null,
  input: { name: string; description: string; visibility: CollectionVisibility },
): Promise<Collection> {
  const row = {
    name: input.name.trim(),
    description: input.description.trim() || null,
    visibility: input.visibility,
  };
  const query = id
    ? supabase.from('collections').update(row).eq('id', id)
    : supabase.from('collections').insert({ ...row, user_id: await currentUserId() });
  const { data, error } = await query.select('*').single();
  if (error) throw error;
  return data as Collection;
}

export async function deleteCollection(id: string) {
  const { error } = await supabase.from('collections').delete().eq('id', id);
  if (error) throw error;
}

// Kullanıcının kendi koleksiyonlarından hangilerinin bu kombini içerdiği.
export async function collectionsContaining(postId: string): Promise<Set<string>> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('collection_posts')
    .select('collection_id, collections!inner(user_id)')
    .eq('post_id', postId)
    .eq('collections.user_id', userId);
  if (error) throw error;
  return new Set(data.map((r) => r.collection_id as string));
}

export async function setInCollection(collectionId: string, postId: string, included: boolean) {
  const { error } = included
    ? await supabase.from('collection_posts').insert({ collection_id: collectionId, post_id: postId })
    : await supabase.from('collection_posts').delete().eq('collection_id', collectionId).eq('post_id', postId);
  if (error && error.code !== '23505') throw error;
}
