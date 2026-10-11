import AsyncStorage from '@react-native-async-storage/async-storage';

import type { DraftImage } from '@/services/media';
import type { OutfitDetails, PostVisibility } from '@/types/database';
import type { AspectOption } from '@/utils/image';

// Paylaşım taslağı cihazda saklanır; bağlantı kesilse veya uygulama kapansa
// da yazılan açıklama ve seçilen fotoğraflar kaybolmaz.
export type PostDraft = {
  images: DraftImage[];
  aspect: AspectOption;
  caption: string;
  styleSlugs: string[];
  outfit: OutfitDetails;
  visibility: PostVisibility;
  commentsEnabled: boolean;
};

const KEY = 'look.post-draft';

export const emptyDraft: PostDraft = {
  images: [],
  aspect: 'original',
  caption: '',
  styleSlugs: [],
  outfit: {},
  visibility: 'public',
  commentsEnabled: true,
};

export async function loadDraft(): Promise<PostDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...emptyDraft, ...(JSON.parse(raw) as Partial<PostDraft>) } : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: PostDraft) {
  AsyncStorage.setItem(KEY, JSON.stringify(draft)).catch(() => {});
}

export function clearDraft() {
  AsyncStorage.removeItem(KEY).catch(() => {});
}
