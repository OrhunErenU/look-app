import * as WebBrowser from 'expo-web-browser';

// Yer tutucu adresler. Yasal metinler ürünün gerçek veri işleme süreçlerine göre hazırlanıp
// yayımlandığında bu adresler güncellenmelidir.
export const LEGAL_URLS = {
  terms: 'https://look-app.example/kullanim-sartlari',
  privacy: 'https://look-app.example/gizlilik',
  contentPolicy: 'https://look-app.example/icerik-politikasi',
  help: 'https://look-app.example/yardim',
} as const;

export const SUPPORT_EMAIL = 'destek@look-app.example';

export function openUrl(url: string) {
  WebBrowser.openBrowserAsync(url).catch(() => {});
}
