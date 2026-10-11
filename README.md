# LOOK

Kombin paylaşımı ve stil keşfi için sosyal mobil uygulama (iOS ve Android).
Kullanıcılar kombinlerini paylaşır, kişisel stil arşivi oluşturur, başkalarının
kombinlerinden ilham alır ve moda üzerinden arkadaşlarıyla etkileşim kurar.

**Teknoloji:** Expo SDK 57 · React Native · TypeScript · Expo Router · Supabase
(PostgreSQL, Auth, Storage, Edge Functions)

## Kurulum

```bash
npm install
cp .env.example .env   # Supabase URL ve anon anahtarını doldur
npx expo start
```

Supabase değerleri girilmeden uygulama açılırsa eksik yapılandırmayı anlatan bir
ekran gösterir.

### Supabase projesi

1. [Supabase](https://supabase.com) üzerinde bir proje oluştur.
2. Supabase CLI ile bağla ve şemayı uygula:
   ```bash
   npx supabase init        # yalnızca config.toml yoksa; migrations klasörüne dokunmaz
   npx supabase link --project-ref <proje-ref>
   npx supabase db push
   npx supabase functions deploy delete-account
   ```
3. **Authentication > URL Configuration** altında yönlendirme adreslerine
   `look://auth/callback` ve `look://reset-password` ekle. Expo Go ile
   geliştirirken `exp://` adreslerini de eklemen gerekir.
4. **Authentication > Providers** altında e-posta doğrulamasını aç; Google ve
   Apple girişini kullanacaksan sağlayıcı bilgilerini gir.
5. Yönetici/moderatör atamak için SQL editöründe:
   ```sql
   insert into public.staff (user_id, role) values ('<kullanıcı-id>', 'admin');
   ```

> `service_role` anahtarı yalnızca Edge Function içinde, sunucu ortam
> değişkeninden okunur. Mobil uygulamaya hiçbir zaman eklenmez.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm start` | Geliştirme sunucusu |
| `npm run typecheck` | TypeScript kontrolü |
| `npm test` | Birim ve bileşen testleri (Jest) |
| `npm run test:db` | Migration + yetkilendirme (RLS) testleri. Boş bir PostgreSQL 16 gerekir: `PGHOST=... PGUSER=postgres npm run test:db` |

Doğal kütüphaneler (görsel seçici, kamera) Expo Go'da çalışır; mağaza sürümü
için `npx eas-cli@latest build` kullanılır.

## Proje yapısı

```
app/                 Expo Router ekranları
  (auth)/            Karşılama, giriş, kayıt, parola sıfırlama
  (tabs)/            Ana Sayfa, Keşfet, Paylaş, Kaydedilenler, Profil
  post/ user/ style/ Ayrıntı ekranları
  settings/          Ayarlar, profil düzenleme, hesap, engellenenler
  onboarding.tsx     Kayıt sonrası profil oluşturma
components/          Ortak ve özelliğe özel arayüz bileşenleri
features/            Veri erişimi ve iş mantığı (auth, posts, profiles, social)
services/            Supabase istemcisi, görsel işleme ve yükleme
constants/theme.ts   Renk, tipografi ve boşluk sistemi (açık/koyu tema)
supabase/
  migrations/        Veritabanı şeması, RLS politikaları, sunucu fonksiyonları
  functions/         Edge Functions (hesap silme)
  tests/             Yetkilendirme testleri
tests/               Jest testleri
```

## Güvenlik modeli

- Tüm tablolarda **Row Level Security** açıktır. Gizlilik ve engelleme kuralları
  arayüzde değil veritabanında uygulanır.
- İstemcinin değiştirmemesi gereken alanlar (sayaçlar, hesap durumu, moderasyon
  durumu) sütun yetkileriyle kapalıdır; sayaçlar tetikleyicilerle tutulur.
- Kombin fotoğrafları özel bir depoda tutulur ve kısa süreli imzalı
  bağlantılarla sunulur. Dosya okuma yetkisi gönderinin görünürlüğüne bağlıdır.
- Fotoğraflar yüklenmeden önce JPEG olarak yeniden kodlanır; bu işlem EXIF ve
  konum bilgilerini siler. Depo yalnızca `image/jpeg` kabul eder.
- Yorum, takip ve paylaşım işlemlerinde hız sınırları vardır.
- Yönetim fonksiyonları (`admin_*`) yalnızca `staff` tablosundaki kişiler
  tarafından çağrılabilir ve her işlem `moderation_actions` tablosuna yazılır.

`supabase/tests/rls_test.sql` bu kuralların 70'e yakın senaryosunu test eder
(gizli hesap, engelleme, başkasının verisini değiştirme, çift beğeni, özel
dosyaya erişim, yönetici yetkisi vb.).

## Durum

İlk sürüm kapsamındaki (doküman §3.1) özelliklerin durumu:

| Özellik | Durum |
| --- | --- |
| Kayıt, giriş, e-posta doğrulama, parola sıfırlama, Google/Apple girişi | Hazır (sağlayıcı ayarları Supabase panelinde yapılmalı) |
| Profil oluşturma, düzenleme, açık/gizli profil, stil tercihleri | Hazır |
| Kombin paylaşma (1–5 fotoğraf, döndürme, oran, kapak, etiketler, kıyafet detayları, görünürlük, yorum izni, taslak koruma) | Hazır |
| Ana sayfa, Keşfet (popüler/yeni/stil/takip edilmeyen filtreleri, öneriler), arama | Hazır |
| Takip ve takip istekleri, beğeni, yorum/yanıt, kaydetme | Hazır |
| Uygulama içi bildirimler ve bildirim tercihleri | Hazır |
| Engelleme, şikâyet, hesap silme | Hazır |
| Moderasyon (veritabanı fonksiyonları ve denetim kaydı) | Hazır |
| Yönetim paneli (web arayüzü) | Yapılacak |
| Push bildirimleri | Yapılacak |
| Hata takibi (Sentry) ve ürün analitiği | Yapılacak |
| Sunucu tarafında EXIF temizleme (istemciyi atlayan yüklemeler için) | Yapılacak |
| Yasal metinler (KVKK, kullanım şartları) | Hukuki destekle hazırlanmalı; `constants/links.ts` içindeki adresler yer tutucudur |
