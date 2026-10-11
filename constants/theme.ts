// LOOK tasarım sistemi. Renkler yalnızca buradan okunur; ekranlar sabit renk
// kodu kullanmaz. Marka yönü: editoryal moda dergisi — siyah ana renk, kırık
// beyaz zemin, taş/gri/soluk zeytin ikincil tonlar.

export const palette = {
  light: {
    background: '#FAF9F6',
    surface: '#FFFFFF',
    text: '#171717',
    textSecondary: '#777777',
    border: '#E8E6E1',
    accent: '#171717',
    onAccent: '#FAF9F6',
    stone: '#D9D3C7',
    olive: '#7D8461',
    success: '#27845A',
    danger: '#C93C3C',
    skeleton: '#EFEDE8',
    overlay: 'rgba(17, 17, 17, 0.45)',
  },
  dark: {
    background: '#111111',
    surface: '#1B1B1B',
    text: '#F5F4F0',
    textSecondary: '#9A9A9A',
    border: '#2A2A2A',
    accent: '#F5F4F0',
    onAccent: '#111111',
    stone: '#3A3631',
    olive: '#A3AA84',
    success: '#3FA676',
    danger: '#E05A5A',
    skeleton: '#232323',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
} as const;

export type ColorScheme = keyof typeof palette;
export type Colors = { [K in keyof (typeof palette)['light']]: string };

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 16,
  pill: 999,
} as const;

// Sistem yazı tipleri iOS (SF Pro) ve Android'de (Roboto) Türkçe karakterleri
// eksiksiz destekler.
export const typography = {
  display: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  title: { fontSize: 20, fontWeight: '600', letterSpacing: -0.2 },
  subtitle: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  username: { fontSize: 14, fontWeight: '500' },
  caption: { fontSize: 13, fontWeight: '400', lineHeight: 18 },
  small: { fontSize: 12, fontWeight: '400' },
} as const;

// Erişilebilir minimum dokunma alanı.
export const HIT_SIZE = 44;
