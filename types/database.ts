// Veritabanı satır tipleri. supabase/migrations ile birebir uyumlu tutulmalıdır.
// Supabase projesi bağlandığında `supabase gen types typescript` çıktısıyla
// değiştirilebilir.

export type PostVisibility = 'public' | 'followers' | 'private';
export type FollowStatus = 'pending' | 'accepted';
export type AccountStatus = 'active' | 'restricted' | 'suspended' | 'banned';
export type ModerationStatus = 'active' | 'under_review' | 'removed';
export type NotificationType =
  | 'follow'
  | 'follow_request'
  | 'follow_accepted'
  | 'like'
  | 'comment'
  | 'reply'
  | 'new_post'
  | 'system';
export type ReportReason =
  | 'harassment'
  | 'hate_speech'
  | 'spam'
  | 'fake_account'
  | 'unauthorized_photo'
  | 'sexual_content'
  | 'copyright'
  | 'other';

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_path: string | null;
  is_private: boolean;
  account_status: AccountStatus;
  follower_count: number;
  following_count: number;
  post_count: number;
  created_at: string;
  updated_at: string;
};

export type ProfileSummary = Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_path'>;

export type Style = {
  id: number;
  slug: string;
  name: string;
  is_active: boolean;
  sort_order: number;
};

export type OutfitDetails = Partial<
  Record<'top' | 'bottom' | 'shoes' | 'outerwear' | 'accessory', string>
>;

export type Post = {
  id: string;
  user_id: string;
  caption: string;
  visibility: PostVisibility;
  comments_enabled: boolean;
  outfit_details: OutfitDetails;
  moderation_status: ModerationStatus;
  like_count: number;
  comment_count: number;
  save_count: number;
  created_at: string;
  updated_at: string;
};

export type PostImage = {
  id: string;
  post_id: string;
  storage_path: string;
  thumb_path: string;
  position: number;
  width: number;
  height: number;
};

// Ekranlarda kullanılan zenginleştirilmiş gönderi.
export type ResolvedImage = PostImage & { url: string; thumbUrl: string };

export type FeedPost = Post & {
  author: ProfileSummary;
  images: ResolvedImage[];
  styles: Pick<Style, 'slug' | 'name'>[];
  liked_by_me: boolean;
  saved_by_me: boolean;
  // Yalnızca Kaydedilenler listesinde dolu gelir; sayfalama için kullanılır.
  saved_at?: string;
};

export type Comment = {
  id: string;
  post_id: string;
  user_id: string;
  parent_id: string | null;
  body: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author: ProfileSummary | null;
};

export type Notification = {
  id: string;
  recipient_id: string;
  actor_id: string | null;
  type: NotificationType;
  post_id: string | null;
  comment_id: string | null;
  body: string | null;
  is_read: boolean;
  created_at: string;
  actor: ProfileSummary | null;
};

export type NotificationSettings = {
  user_id: string;
  likes: boolean;
  comments: boolean;
  follows: boolean;
  new_posts: boolean;
  email: boolean;
};
