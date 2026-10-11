// Sunucu ve ağ hatalarını kullanıcının anlayacağı Türkçe mesajlara çevirir.

type MaybeError = { message?: string; code?: string; status?: number; name?: string } | null | undefined;

const AUTH_MESSAGES: Record<string, string> = {
  'Invalid login credentials': 'E-posta veya parola hatalı.',
  'Email not confirmed': 'E-posta adresini henüz doğrulamadın. Gelen kutunu kontrol et.',
  'User already registered': 'Bu e-posta adresiyle zaten bir hesap var.',
  'Email rate limit exceeded': 'Çok fazla deneme yapıldı. Biraz sonra tekrar dene.',
};

export function friendlyError(error: unknown, fallback = 'Bir şeyler ters gitti. Tekrar dene.'): string {
  const e = error as MaybeError;
  if (!e) return fallback;
  const message = e.message ?? '';

  if (/network request failed|failed to fetch|fetch failed/i.test(message)) {
    return 'İnternet bağlantını kontrol et ve tekrar dene.';
  }
  if (AUTH_MESSAGES[message]) return AUTH_MESSAGES[message];
  if (e.code === '23505') {
    if (/username/.test(message)) return 'Bu kullanıcı adı alınmış.';
    return 'Bu işlem zaten yapılmış.';
  }
  if (e.code === '23514' && /username/.test(message)) return 'Kullanıcı adı geçersiz.';
  if (e.code === '42501') return 'Bu işlem için yetkin yok.';
  // Veritabanı fonksiyonlarının kendi Türkçe mesajları doğrudan gösterilir.
  if (e.code === 'P0001' || e.code === 'P0429' || e.code === 'P0409' || e.code === '22023' || e.code === 'P0002') {
    return message || fallback;
  }
  return fallback;
}
