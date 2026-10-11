import { supabase } from '@/services/supabase';
import type { FollowStatus, Profile, ProfileSummary, Style } from '@/types/database';
import { normalizeUsername } from '@/utils/validation';

export async function fetchMyProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function fetchProfileByUsername(username: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', normalizeUsername(username))
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function isUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available', {
    p_username: normalizeUsername(username),
  });
  if (error) throw error;
  return Boolean(data);
}

export async function createProfile(input: {
  username: string;
  displayName: string;
  bio: string;
  birthDate: string;
  styleSlugs: string[];
}): Promise<Profile> {
  const { data, error } = await supabase.rpc('create_profile', {
    p_username: normalizeUsername(input.username),
    p_display_name: input.displayName,
    p_bio: input.bio,
    p_birth_date: input.birthDate,
    p_style_slugs: input.styleSlugs,
  });
  if (error) throw error;
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  changes: Partial<Pick<Profile, 'username' | 'display_name' | 'bio' | 'avatar_path' | 'is_private'>>,
) {
  const payload = { ...changes };
  if (payload.username) payload.username = normalizeUsername(payload.username);
  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  if (error) throw error;
}

export async function fetchUserStyles(userId: string): Promise<Pick<Style, 'slug' | 'name'>[]> {
  const { data, error } = await supabase
    .from('user_styles')
    .select('styles(slug, name, sort_order)')
    .eq('user_id', userId);
  if (error) throw error;
  const rows = data as unknown as { styles: (Pick<Style, 'slug' | 'name' | 'sort_order'>) | null }[];
  return rows
    .flatMap((r) => (r.styles ? [r.styles] : []))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ slug, name }) => ({ slug, name }));
}

export async function setUserStyles(userId: string, slugs: string[]) {
  const { data: styles, error } = await supabase.from('styles').select('id, slug').in('slug', slugs);
  if (error) throw error;
  const del = await supabase.from('user_styles').delete().eq('user_id', userId);
  if (del.error) throw del.error;
  if (styles.length > 0) {
    const ins = await supabase
      .from('user_styles')
      .insert(styles.map((s) => ({ user_id: userId, style_id: s.id })));
    if (ins.error) throw ins.error;
  }
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('search_profiles', { p_query: query, p_limit: 20 });
  if (error) throw error;
  return data as Profile[];
}

export async function suggestedProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase.rpc('suggested_profiles', { p_limit: 10 });
  if (error) throw error;
  return data as Profile[];
}

// Takip ---------------------------------------------------------------------

export async function followStatus(viewerId: string, targetId: string): Promise<FollowStatus | null> {
  const { data, error } = await supabase
    .from('follows')
    .select('status')
    .eq('follower_id', viewerId)
    .eq('following_id', targetId)
    .maybeSingle();
  if (error) throw error;
  return (data?.status as FollowStatus | undefined) ?? null;
}

export async function follow(targetId: string): Promise<FollowStatus> {
  const { data, error } = await supabase.rpc('follow_user', { p_target: targetId });
  if (error) throw error;
  return data as FollowStatus;
}

export async function unfollow(viewerId: string, targetId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', viewerId)
    .eq('following_id', targetId);
  if (error) throw error;
}

export async function removeFollower(viewerId: string, followerId: string) {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', viewerId);
  if (error) throw error;
}

export async function respondFollowRequest(followerId: string, accept: boolean) {
  const { error } = await supabase.rpc('respond_follow_request', {
    p_follower: followerId,
    p_accept: accept,
  });
  if (error) throw error;
}

export async function fetchFollowList(
  userId: string,
  kind: 'followers' | 'following' | 'requests',
): Promise<ProfileSummary[]> {
  const isFollowers = kind !== 'following';
  const { data, error } = await supabase
    .from('follows')
    .select(
      isFollowers
        ? 'created_at, profile:profiles!follows_follower_id_fkey(id, username, display_name, avatar_path)'
        : 'created_at, profile:profiles!follows_following_id_fkey(id, username, display_name, avatar_path)',
    )
    .eq(isFollowers ? 'following_id' : 'follower_id', userId)
    .eq('status', kind === 'requests' ? 'pending' : 'accepted')
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const rows = data as unknown as { profile: ProfileSummary | null }[];
  return rows.flatMap((r) => (r.profile ? [r.profile] : []));
}
