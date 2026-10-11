import * as Linking from 'expo-linking';
import { Share } from 'react-native';

import type { FeedPost } from '@/types/database';

// Paylaşım bağlantılarının web adresi (örn. https://look.app). Tanımlı değilse
// uygulama bağlantısı (look://...) kullanılır. Web önizleme sayfaları ve
// evrensel bağlantılar (Universal Links / App Links) yayına çıkarken
// yapılandırılmalıdır.
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL?.replace(/\/$/, '');

export function postLink(post: Pick<FeedPost, 'id' | 'author'>): string {
  return WEB_URL ? `${WEB_URL}/@${post.author.username}/${post.id}` : Linking.createURL(`post/${post.id}`);
}

export function profileLink(username: string): string {
  return WEB_URL ? `${WEB_URL}/@${username}` : Linking.createURL(`user/${username}`);
}

// Yalnızca herkese açık kombinler paylaşılabilir. Bağlantıyı açan kişi yine
// gönderinin görünürlük kurallarına tabidir.
export function canShare(post: Pick<FeedPost, 'visibility'>) {
  return post.visibility === 'public';
}

export async function sharePost(post: Pick<FeedPost, 'id' | 'title' | 'author' | 'visibility'>) {
  const link = postLink(post);
  const title = post.title || 'Bir kombin';
  await Share.share({ message: `${title} · @${post.author.username} LOOK'ta\n${link}`, url: link }).catch(() => {});
}

export async function shareProfile(username: string, own: boolean) {
  const link = profileLink(username);
  const message = own
    ? `LOOK'ta kombinlerimi paylaşıyorum, beni takip et: @${username}\n${link}`
    : `@${username} LOOK'ta\n${link}`;
  await Share.share({ message, url: link }).catch(() => {});
}
