import { randomUUID } from 'expo-crypto';

import {
  WARDROBE_BUCKET,
  removePostFiles,
  signedUrls,
  uploadPostImages,
  type DraftImage,
} from '@/services/media';
import { supabase } from '@/services/supabase';
import type {
  FeedPost,
  OutfitDetails,
  Post,
  PostImage,
  PostItemDetail,
  PostVisibility,
  ProfileSummary,
  Style,
  TagSummary,
} from '@/types/database';
import type { AspectOption } from '@/utils/image';

export const PAGE_SIZE = 12;

const POST_SELECT = `
  *,
  author:profiles(id, username, display_name, avatar_path),
  images:post_images(id, post_id, storage_path, thumb_path, position, width, height),
  post_styles(styles(slug, name, kind))
`;

type RawPost = Post & {
  author: ProfileSummary | null;
  images: PostImage[];
  post_styles: { styles: TagSummary | null }[];
};

export async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Oturum bulunamadı.');
  return id;
}

// Ham kombinleri ekranda kullanılacak hâle getirir: görsel bağlantıları,
// beğeni ve kaydetme durumları tek seferde çözülür.
async function hydrate(raw: RawPost[]): Promise<FeedPost[]> {
  const posts = raw.filter((p) => p.author && p.images.length > 0);
  if (posts.length === 0) return [];
  const userId = await currentUserId();
  const ids = posts.map((p) => p.id);

  const paths = posts.flatMap((p) => p.images.flatMap((i) => [i.storage_path, i.thumb_path]));
  const [urls, likes, saves] = await Promise.all([
    signedUrls(paths),
    supabase.from('likes').select('post_id').eq('user_id', userId).in('post_id', ids),
    supabase.from('saved_posts').select('post_id').eq('user_id', userId).in('post_id', ids),
  ]);
  if (likes.error) throw likes.error;
  if (saves.error) throw saves.error;
  const liked = new Set(likes.data.map((l) => l.post_id as string));
  const saved = new Set(saves.data.map((s) => s.post_id as string));

  return posts.map(({ post_styles, author, images, ...post }) => ({
    ...post,
    author: author!,
    images: [...images]
      .sort((a, b) => a.position - b.position)
      .map((image) => ({
        ...image,
        url: urls[image.storage_path] ?? '',
        thumbUrl: urls[image.thumb_path] ?? urls[image.storage_path] ?? '',
      })),
    styles: post_styles.flatMap((ps) => (ps.styles ? [ps.styles] : [])),
    liked_by_me: liked.has(post.id),
    saved_by_me: saved.has(post.id),
  }));
}

async function rpcPosts(fn: string, args: Record<string, unknown>): Promise<FeedPost[]> {
  const { data, error } = await supabase.rpc(fn, args).select(POST_SELECT);
  if (error) throw error;
  return hydrate(data as unknown as RawPost[]);
}

export function fetchHomeFeed(before?: string): Promise<FeedPost[]> {
  return rpcPosts('home_feed', { p_before: before ?? null, p_limit: PAGE_SIZE });
}

export type ExploreMode = 'for_you' | 'popular' | 'new' | 'network';

export type ExploreFilter = {
  style: string | null;
  mode: ExploreMode;
  onlyUnfollowed: boolean;
};

export function fetchExplore(filter: ExploreFilter, offset: number): Promise<FeedPost[]> {
  return rpcPosts('explore_feed', {
    p_style: filter.style,
    p_mode: filter.mode,
    p_only_unfollowed: filter.onlyUnfollowed,
    p_offset: offset,
    p_limit: PAGE_SIZE * 2,
  });
}

export function fetchFeatured(): Promise<FeedPost[]> {
  return rpcPosts('featured_posts', { p_limit: 10 });
}

export function fetchSimilarPosts(postId: string): Promise<FeedPost[]> {
  return rpcPosts('similar_posts', { p_post_id: postId, p_limit: 12 });
}

export function searchPosts(query: string): Promise<FeedPost[]> {
  return rpcPosts('search_posts', { p_query: query, p_limit: 30 });
}

export async function fetchPost(id: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from('posts').select(POST_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await hydrate([data as unknown as RawPost]);
  return post ?? null;
}

// Profil ızgarası: öne çıkarılan kombinler en üstte, sonra en yeniler.
export async function fetchUserPosts(userId: string, before?: string): Promise<FeedPost[]> {
  const pinnedQuery = before
    ? Promise.resolve({ data: [] as unknown[], error: null })
    : supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('user_id', userId)
        .not('pinned_at', 'is', null)
        .neq('moderation_status', 'removed')
        .order('pinned_at', { ascending: false });
  let restQuery = supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('user_id', userId)
    .is('pinned_at', null)
    .neq('moderation_status', 'removed')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE * 2);
  if (before) restQuery = restQuery.lt('created_at', before);

  const [pinned, rest] = await Promise.all([pinnedQuery, restQuery]);
  if (pinned.error) throw pinned.error;
  if (rest.error) throw rest.error;
  return hydrate([...(pinned.data ?? []), ...(rest.data ?? [])] as unknown as RawPost[]);
}

// Profil sayfalaması öne çıkarılmamış en eski kombinin tarihinden devam eder.
export function lastUnpinnedDate(posts: FeedPost[]): string | undefined {
  return posts.filter((p) => !p.pinned_at).at(-1)?.created_at;
}

export async function fetchSavedPosts(before?: string): Promise<FeedPost[]> {
  const userId = await currentUserId();
  let query = supabase
    .from('saved_posts')
    .select(`created_at, post:posts(${POST_SELECT})`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE * 2);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  // Sahibi silinmiş veya artık görülemeyen kombinler listede gösterilmez.
  const rows = data as unknown as { created_at: string; post: RawPost | null }[];
  const posts = await hydrate(rows.flatMap((r) => (r.post ? [r.post] : [])));
  const savedAt = new Map(rows.map((r) => [r.post?.id, r.created_at]));
  return posts.map((p) => ({ ...p, saved_at: savedAt.get(p.id) }));
}

export async function fetchCollectionPosts(collectionId: string, before?: string): Promise<FeedPost[]> {
  let query = supabase
    .from('collection_posts')
    .select(`added_at, post:posts(${POST_SELECT})`)
    .eq('collection_id', collectionId)
    .order('added_at', { ascending: false })
    .limit(PAGE_SIZE * 2);
  if (before) query = query.lt('added_at', before);
  const { data, error } = await query;
  if (error) throw error;
  const rows = data as unknown as { added_at: string; post: RawPost | null }[];
  const posts = await hydrate(rows.flatMap((r) => (r.post ? [r.post] : [])));
  const addedAt = new Map(rows.map((r) => [r.post?.id, r.added_at]));
  return posts.map((p) => ({ ...p, saved_at: addedAt.get(p.id) }));
}

export function fetchStylePosts(slug: string, offset: number): Promise<FeedPost[]> {
  return fetchExplore({ style: slug, mode: 'new', onlyUnfollowed: false }, offset);
}

export async function fetchPostItems(postId: string): Promise<PostItemDetail[]> {
  const { data, error } = await supabase.rpc('post_item_details', { p_post_id: postId });
  if (error) throw error;
  const rows = data as Omit<PostItemDetail, 'thumbUrl'>[];
  const paths = rows.flatMap((r) => (r.thumb_path ? [r.thumb_path] : []));
  const urls = paths.length ? await signedUrls(paths, WARDROBE_BUCKET) : {};
  return rows.map((r) => ({ ...r, thumbUrl: r.thumb_path ? (urls[r.thumb_path] ?? null) : null }));
}

export type NewPostInput = {
  title: string;
  caption: string;
  styleSlugs: string[];
  outfit: OutfitDetails;
  visibility: PostVisibility;
  commentsEnabled: boolean;
  images: DraftImage[];
  aspect: AspectOption;
  itemIds: string[];
};

export async function createPost(
  input: NewPostInput,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const userId = await currentUserId();
  const postId = randomUUID();
  const uploaded = await uploadPostImages(userId, postId, input.images, input.aspect, onProgress);

  const outfit = Object.fromEntries(
    Object.entries(input.outfit)
      .map(([k, v]) => [k, v?.trim()])
      .filter(([, v]) => Boolean(v)),
  );

  const { error } = await supabase.rpc('create_post', {
    p_post_id: postId,
    p_title: input.title.trim(),
    p_caption: input.caption.trim(),
    p_visibility: input.visibility,
    p_comments_enabled: input.commentsEnabled,
    p_outfit_details: outfit,
    p_style_slugs: input.styleSlugs,
    p_images: uploaded,
    p_item_ids: input.itemIds,
  });
  if (error) {
    // Kayıt oluşturulamazsa yüklenen dosyalar yarım kalmasın.
    await removePostFiles(uploaded.flatMap((u) => [u.storage_path, u.thumb_path]));
    throw error;
  }
  return postId;
}

export async function updatePost(
  id: string,
  changes: {
    title: string;
    caption: string;
    visibility: PostVisibility;
    commentsEnabled: boolean;
    styleSlugs: string[];
    itemIds: string[];
    imageOrder: string[];
  },
) {
  const { error } = await supabase
    .from('posts')
    .update({
      title: changes.title.trim(),
      caption: changes.caption.trim(),
      visibility: changes.visibility,
      comments_enabled: changes.commentsEnabled,
    })
    .eq('id', id);
  if (error) throw error;
  const results = await Promise.all([
    supabase.rpc('set_post_styles', { p_post_id: id, p_style_slugs: changes.styleSlugs }),
    supabase.rpc('attach_post_items', { p_post_id: id, p_item_ids: changes.itemIds }),
    supabase.rpc('reorder_post_images', { p_post_id: id, p_image_ids: changes.imageOrder }),
  ]);
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

export async function setPinned(postId: string, pinned: boolean) {
  const { error } = await supabase
    .from('posts')
    .update({ pinned_at: pinned ? new Date().toISOString() : null })
    .eq('id', postId);
  if (error) throw error;
}

export async function deletePost(post: Pick<FeedPost, 'id' | 'images'>) {
  const { error } = await supabase.from('posts').delete().eq('id', post.id);
  if (error) throw error;
  await removePostFiles(post.images.flatMap((i) => [i.storage_path, i.thumb_path]));
}

export async function setLiked(postId: string, liked: boolean) {
  const userId = await currentUserId();
  const { error } = liked
    ? await supabase.from('likes').insert({ user_id: userId, post_id: postId })
    : await supabase.from('likes').delete().eq('user_id', userId).eq('post_id', postId);
  // Aynı beğeni zaten varsa sorun değildir.
  if (error && error.code !== '23505') throw error;
}

export async function setSaved(postId: string, saved: boolean) {
  const userId = await currentUserId();
  const { error } = saved
    ? await supabase.from('saved_posts').insert({ user_id: userId, post_id: postId })
    : await supabase.from('saved_posts').delete().eq('user_id', userId).eq('post_id', postId);
  if (error && error.code !== '23505') throw error;
}

export async function hidePost(postId: string) {
  const userId = await currentUserId();
  const { error } = await supabase.from('hidden_posts').insert({ user_id: userId, post_id: postId });
  if (error && error.code !== '23505') throw error;
}

export async function fetchStyles(): Promise<Style[]> {
  const { data, error } = await supabase
    .from('styles')
    .select('*')
    .eq('is_active', true)
    .order('kind')
    .order('sort_order');
  if (error) throw error;
  return data as Style[];
}
