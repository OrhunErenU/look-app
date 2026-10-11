import { supabase } from '@/services/supabase';
import type {
  Comment,
  Notification,
  NotificationSettings,
  ProfileSummary,
  ReportReason,
} from '@/types/database';

const AUTHOR = 'author:profiles(id, username, display_name, avatar_path)';

// Yorumlar -------------------------------------------------------------------

export async function fetchComments(postId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select(`*, ${AUTHOR}`)
    .eq('post_id', postId)
    .order('created_at', { ascending: true })
    .limit(500);
  if (error) throw error;
  return data as Comment[];
}

export async function addComment(postId: string, userId: string, body: string, parentId?: string) {
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, user_id: userId, body: body.trim(), parent_id: parentId ?? null })
    .select(`*, ${AUTHOR}`)
    .single();
  if (error) throw error;
  return data as Comment;
}

export async function editComment(commentId: string, body: string) {
  const { error } = await supabase.from('comments').update({ body: body.trim() }).eq('id', commentId);
  if (error) throw error;
}

export async function deleteComment(commentId: string) {
  const { error } = await supabase.rpc('delete_comment', { p_comment_id: commentId });
  if (error) throw error;
}

// Bildirimler ----------------------------------------------------------------

export async function fetchNotifications(before?: string): Promise<Notification[]> {
  let query = supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(id, username, display_name, avatar_path)')
    .order('created_at', { ascending: false })
    .limit(30);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return data as Notification[];
}

export async function unreadNotificationCount(): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllNotificationsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('recipient_id', userId)
    .eq('is_read', false);
  if (error) throw error;
}

export async function fetchNotificationSettings(userId: string): Promise<NotificationSettings | null> {
  const { data, error } = await supabase
    .from('notification_settings')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data as NotificationSettings | null;
}

export async function updateNotificationSettings(
  userId: string,
  changes: Partial<Omit<NotificationSettings, 'user_id'>>,
) {
  const { error } = await supabase.from('notification_settings').update(changes).eq('user_id', userId);
  if (error) throw error;
}

// Güvenlik -------------------------------------------------------------------

export async function blockUser(targetId: string) {
  const { error } = await supabase.rpc('block_user', { p_target: targetId });
  if (error) throw error;
}

export async function unblockUser(viewerId: string, targetId: string) {
  const { error } = await supabase
    .from('blocks')
    .delete()
    .eq('blocker_id', viewerId)
    .eq('blocked_id', targetId);
  if (error) throw error;
}

export async function fetchBlockedUsers(): Promise<ProfileSummary[]> {
  // Engellenen profiller RLS gereği okunamaz; liste sunucu fonksiyonundan gelir.
  const { data, error } = await supabase.rpc('my_blocked_users');
  if (error) throw error;
  return data as ProfileSummary[];
}

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Taciz' },
  { value: 'hate_speech', label: 'Nefret söylemi' },
  { value: 'spam', label: 'Spam' },
  { value: 'fake_account', label: 'Sahte hesap' },
  { value: 'unauthorized_photo', label: 'İzinsiz paylaşılan fotoğraf' },
  { value: 'sexual_content', label: 'Cinsel veya uygunsuz içerik' },
  { value: 'copyright', label: 'Telif hakkı ihlali' },
  { value: 'other', label: 'Diğer' },
];

export async function submitReport(input: {
  reporterId: string;
  reason: ReportReason;
  details?: string;
  userId?: string;
  postId?: string;
  commentId?: string;
}) {
  const { error } = await supabase.from('reports').insert({
    reporter_id: input.reporterId,
    reason: input.reason,
    details: input.details?.trim() || null,
    reported_user_id: input.userId ?? null,
    post_id: input.postId ?? null,
    comment_id: input.commentId ?? null,
  });
  if (error) throw error;
}

// Hesap ----------------------------------------------------------------------

// Depolamadaki dosyalar ve kimlik kaydı yönetici yetkisi gerektirdiği için
// hesap silme işlemi sunucu fonksiyonunda yapılır.
export async function deleteAccount() {
  const { error } = await supabase.functions.invoke('delete-account', { method: 'POST' });
  if (error) throw error;
}
