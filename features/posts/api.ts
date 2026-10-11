import { randomUUID } from 'expo-crypto';

import { removePostFiles, signedUrls, uploadPostImages, type DraftImage } from '@/services/media';
import { supabase } from '@/services/supabase';
import type {
  FeedPost,
  OutfitDetails,
  Post,
  PostImage,
  PostVisibility,
  ProfileSummary,
  Style,
} from '@/types/database';
import type { AspectOption } from '@/utils/image';

export const PAGE_SIZE = 12;

const POST_SELECT = `
  *,
  author:profiles(id, username, display_name, avatar_path),
  images:post_images(id, post_id, storage_path, thumb_path, position, width, height),
  post_styles(styles(slug, name))
`;

type RawPost = Post & {
  author: ProfileSummary | null;
  images: PostImage[];
  post_styles: { styles: Pick<Style, 'slug' | 'name'> | null }[];
};

async function currentUserId(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const id = data.session?.user.id;
  if (!id) throw new Error('Oturum bulunamadı.');
  return id;
}

// Ham gönderileri ekranda kullanılacak hâle getirir: görsel bağlantıları,
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

export async function fetchHomeFeed(before?: string): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .rpc('home_feed', { p_before: before ?? null, p_limit: PAGE_SIZE })
    .select(POST_SELECT);
  if (error) throw error;
  return hydrate(data as unknown as RawPost[]);
}

export type ExploreFilter = {
  style: string | null;
  mode: 'popular' | 'new';
  onlyUnfollowed: boolean;
};

export async function fetchExplore(filter: ExploreFilter, offset: number): Promise<FeedPost[]> {
  const { data, error } = await supabase
    .rpc('explore_feed', {
      p_style: filter.style,
      p_mode: filter.mode,
      p_only_unfollowed: filter.onlyUnfollowed,
      p_offset: offset,
      p_limit: PAGE_SIZE * 2,
    })
    .select(POST_SELECT);
  if (error) throw error;
  return hydrate(data as unknown as RawPost[]);
}

export async function fetchPost(id: string): Promise<FeedPost | null> {
  const { data, error } = await supabase.from('posts').select(POST_SELECT).eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const [post] = await hydrate([data as unknown as RawPost]);
  return post ?? null;
}

export async function fetchUserPosts(userId: string, before?: string): Promise<FeedPost[]> {
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('user_id', userId)
    .neq('moderation_status', 'removed')
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE * 2);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return hydrate(data as unknown as RawPost[]);
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
  // Sahibi silinmiş veya artık görülemeyen gönderiler listede gösterilmez.
  const rows = data as unknown as { created_at: string; post: RawPost | null }[];
  const posts = await hydrate(rows.flatMap((r) => (r.post ? [r.post] : [])));
  const savedAt = new Map(rows.map((r) => [r.post?.id, r.created_at]));
  return posts.map((p) => ({ ...p, saved_at: savedAt.get(p.id) }));
}

export async function fetchStylePosts(slug: string, offset: number): Promise<FeedPost[]> {
  return fetchExplore({ style: slug, mode: 'new', onlyUnfollowed: false }, offset);
}

export type NewPostInput = {
  caption: string;
  styleSlugs: string[];
  outfit: OutfitDetails;
  visibility: PostVisibility;
  commentsEnabled: boolean;
  images: DraftImage[];
  aspect: AspectOption;
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
    p_caption: input.caption.trim(),
    p_visibility: input.visibility,
    p_comments_enabled: input.commentsEnabled,
    p_outfit_details: outfit,
    p_style_slugs: input.styleSlugs,
    p_images: uploaded,
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
  changes: { caption: string; visibility: PostVisibility; commentsEnabled: boolean; styleSlugs: string[] },
) {
  const { error } = await supabase
    .from('posts')
    .update({
      caption: changes.caption.trim(),
      visibility: changes.visibility,
      comments_enabled: changes.commentsEnabled,
    })
    .eq('id', id);
  if (error) throw error;
  const styles = await supabase.rpc('set_post_styles', { p_post_id: id, p_style_slugs: changes.styleSlugs });
  if (styles.error) throw styles.error;
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
    .order('sort_order');
  if (error) throw error;
  return data as Style[];
}
