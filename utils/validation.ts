// Formlarda kullanılan doğrulama kuralları. Aynı kurallar veritabanında da
// kısıtlama olarak bulunur; istemci tarafı yalnızca erken geri bildirim içindir.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const BIO_MAX = 160;
export const DISPLAY_NAME_MAX = 50;
export const TITLE_MAX = 80;
export const CAPTION_MAX = 2200;
export const COMMENT_MAX = 500;
export const MIN_AGE = 18;
export const PASSWORD_MIN = 8;

// "OrhunLook" ve "orhunlook" aynı kullanıcı adıdır.
export function normalizeUsername(input: string): string {
  return input.trim().replace(/^@+/, '').toLowerCase();
}

export function validateUsername(input: string): string | null {
  const value = normalizeUsername(input);
  if (value.length < USERNAME_MIN) return `Kullanıcı adı en az ${USERNAME_MIN} karakter olmalı.`;
  if (value.length > USERNAME_MAX) return `Kullanıcı adı en fazla ${USERNAME_MAX} karakter olabilir.`;
  if (!/^[a-z0-9._]+$/.test(value)) {
    return 'Yalnızca İngilizce harf, rakam, nokta ve alt çizgi kullanabilirsin.';
  }
  if (value.startsWith('.') || value.endsWith('.')) return 'Kullanıcı adı nokta ile başlayamaz veya bitemez.';
  if (value.includes('..')) return 'Kullanıcı adında art arda iki nokta olamaz.';
  return null;
}

export function validateEmail(input: string): string | null {
  const value = input.trim();
  if (!value) return 'E-posta adresini gir.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'Geçerli bir e-posta adresi gir.';
  return null;
}

export function validatePassword(input: string): string | null {
  if (input.length < PASSWORD_MIN) return `Parola en az ${PASSWORD_MIN} karakter olmalı.`;
  if (!/[a-zA-Z]/.test(input) || !/[0-9]/.test(input)) return 'Parola harf ve rakam içermeli.';
  return null;
}

// GG.AA.YYYY biçimindeki tarihi ISO (YYYY-AA-GG) biçimine çevirir.
export function parseTurkishDate(input: string): string | null {
  const match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(input.trim());
  if (!match) return null;
  const [, d, m, y] = match;
  const day = Number(d);
  const month = Number(m);
  const year = Number(y);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function ageOn(isoBirthDate: string, today: Date = new Date()): number {
  const [y, m, d] = isoBirthDate.split('-').map(Number);
  let age = today.getFullYear() - y;
  const beforeBirthday =
    today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d);
  if (beforeBirthday) age -= 1;
  return age;
}

export function validateBirthDate(input: string, today: Date = new Date()): string | null {
  const iso = parseTurkishDate(input);
  if (!iso) return 'Doğum tarihini GG.AA.YYYY biçiminde gir.';
  const age = ageOn(iso, today);
  if (age > 120 || age < 0) return 'Geçerli bir doğum tarihi gir.';
  if (age < MIN_AGE) return `LOOK şu an yalnızca ${MIN_AGE} yaş ve üzeri kullanıcılara açık.`;
  return null;
}
