import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isConfigured = Boolean(url && anonKey);

// Panel yalnızca herkese açık anon anahtarı kullanır. Tüm yönetim yetkileri
// veritabanında personel rolü ve iki adımlı doğrulama (aal2) ile denetlenir.
export const supabase = createClient(url ?? 'http://localhost:54321', anonKey ?? 'missing', {
  auth: { persistSession: true, autoRefreshToken: true, storageKey: 'look-admin-auth' },
});

export type StaffRole = 'support' | 'moderator' | 'admin' | 'owner';

export const ROLE_LEVEL: Record<StaffRole, number> = { support: 1, moderator: 2, admin: 3, owner: 4 };

export const ROLE_LABELS: Record<StaffRole, string> = {
  support: 'Destek görevlisi',
  moderator: 'Moderatör',
  admin: 'Yönetici',
  owner: 'Sistem sahibi',
};

export function errorMessage(error: unknown): string {
  const e = error as { message?: string; code?: string } | null;
  if (!e) return 'Bilinmeyen hata.';
  if (e.code === '42501') return e.message && e.message !== 'Yetkisiz işlem.' ? e.message : 'Bu işlem için yetkin yok.';
  return e.message ?? 'Bilinmeyen hata.';
}

const signedCache = new Map<string, string>();

export async function signedUrl(bucket: 'post-images' | 'wardrobe', path: string): Promise<string | null> {
  const key = `${bucket}:${path}`;
  if (signedCache.has(key)) return signedCache.get(key)!;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 30);
  if (data?.signedUrl) signedCache.set(key, data.signedUrl);
  return data?.signedUrl ?? null;
}

export function avatarUrl(path: string | null) {
  return path ? supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl : null;
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' });
}
