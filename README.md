# LOOK

Sosyal kombin ve kişisel stil platformu (iOS ve Android). Kullanıcılar kendi
tarzlarını oluşturur, kombinlerini arşivler, yeni stiller keşfeder ve tarzlarını
arkadaşlarıyla paylaşır. Ürünün merkezindeki üç davranış: **Create**, **Discover**,
**Connect**. Dijital gardırop ve koleksiyonlar bu döngüyü destekler.

**Teknoloji:** Expo SDK 57 · React Native · TypeScript · Expo Router · Supabase
(PostgreSQL, Auth, Storage, Edge Functions) · Yönetim paneli: Vite + React

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
   npx supabase functions deploy send-push --no-verify-jwt
   ```
3. **Authentication > URL Configuration** altında yönlendirme adreslerine
   `look://auth/callback` ve `look://reset-password` ekle. Expo Go ile
   geliştirirken `exp://` adreslerini de eklemen gerekir.
4. **Authentication > Providers** altında e-posta doğrulamasını aç; Google ve
   Apple girişini kullanacaksan sağlayıcı bilgilerini gir.
5. **Authentication > Multi-Factor** altında TOTP'yi aç. Yönetim paneli iki adımlı
   doğrulama olmadan hiçbir personel yetkisi tanımaz.
6. İlk sistem sahibini SQL editöründen ata (sonraki personeli panelden atarsın):
   ```sql
   insert into public.staff (user_id, role) values ('<kullanıcı-id>', 'owner');
   ```

> `service_role` anahtarı yalnızca Edge Function'larda, sunucu ortam
> değişkeninden okunur. Mobil uygulamaya veya panele hiçbir zaman eklenmez.

### Push bildirimleri (isteğe bağlı)

1. `npx eas-cli@latest init` ile EAS proje kimliğini `app.json`'a ekle.
2. `npx supabase secrets set PUSH_WEBHOOK_SECRET=<rastgele-uzun-değer>`
3. **Database > Webhooks**: `public.notifications` tablosunda INSERT için
   `send-push` fonksiyonunu çağıran bir webhook oluştur ve
   `x-webhook-secret` başlığına aynı değeri yaz.

Kullanıcı anlık bildirimleri Ayarlar'dan kendisi açar; izin vermezse bildirimler
uygulama içinde görünmeye devam eder.

### Yönetim paneli

```bash
cd admin
npm install
cp .env.example .env   # mobil uygulamayla aynı Supabase URL ve anon anahtar
npm run dev
```

Panel ayrı bir statik web uygulamasıdır (`npm run build` → `admin/dist`). Herhangi
bir statik barındırmada yayımlanabilir; yetkilendirme tamamen veritabanındadır.

| Rol | Yetki |
| --- | --- |
| Destek görevlisi | Kullanıcıları (e-posta dahil), şikâyetleri, içerikleri ve işlem günlüğünü görür |
| Moderatör | İçerik kaldırır/geri yükler, yorum siler, kullanıcı uyarır, hesap kısıtlar veya askıya alır, şikâyet sonuçlandırır |
| Yönetici | Hesap kapatır, keşfette öne çıkarır, örnek içerik işaretler, etiketleri, duyuruyu, bakım modunu ve özellik bayraklarını yönetir |
| Sistem sahibi | Personel atar ve rollerini değiştirir |

Her yönetim işlemi `moderation_actions` tablosuna yazılır. Kaldırılan kombinin
sahibine ve uyarılan kullanıcıya uygulama içi bildirim gider.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm start` | Geliştirme sunucusu |
| `npm run typecheck` | TypeScript kontrolü |
| `npm test` | Birim ve bileşen testleri (Jest) |
| `npm run test:db` | Migration + yetkilendirme (RLS) testleri. Boş bir PostgreSQL 16 gerekir: `PGHOST=... PGUSER=postgres npm run test:db` |
| `cd admin && npm run build` | Yönetim paneli tip kontrolü ve derleme |

## Proje yapısı

```
app/                     Expo Router ekranları
  (auth)/                Karşılama, giriş, kayıt, parola sıfırlama
  (tabs)/                Ana Sayfa, Keşfet, Paylaş, Gardırop, Profil
  post/ user/ style/     Kombin ayrıntısı ve düzenleme, profil, etiket akışı
  collection/            Koleksiyon ayrıntısı, oluşturma, kombin ekleme
  wardrobe/              Parça ekleme/düzenleme, parça seçici
  settings/              Ayarlar, profil düzenleme, hesap, engellenenler
  onboarding.tsx         Kayıt sonrası profil oluşturma ve arkadaş bulma
components/              Ortak ve özelliğe özel arayüz bileşenleri
features/                Veri erişimi ve iş mantığı (auth, posts, wardrobe,
                         collections, profiles, social, notifications, app-config)
services/                Supabase istemcisi, görsel işleme ve yükleme
constants/theme.ts       Renk, tipografi ve boşluk sistemi (açık/koyu tema)
admin/                   Web yönetim paneli
supabase/
  migrations/            Şema, RLS politikaları, sunucu fonksiyonları
  functions/             Edge Functions (hesap silme, push gönderimi)
  tests/                 Yetkilendirme testleri
tests/                   Jest testleri
```

### Şartnamedeki tablo adlarıyla eşleşme

| Şartname | Veritabanı |
| --- | --- |
| outfits / outfit_photos | `posts` / `post_images` |
| tags / outfit_tags | `styles` (tür: stil, mevsim, kullanım alanı) / `post_styles` |
| saved_outfits | `saved_posts` |
| outfit_items | `post_items` |
| collection_outfits | `collection_posts` |
| wardrobe_items, collections, follows, likes, comments, notifications, reports, blocks, device_tokens | Aynı adlarla |

## Ürün ve güvenlik kararları

- **RLS her yerde.** Gizlilik, görünürlük ve engelleme kuralları arayüzde değil
  veritabanında uygulanır. İstemcinin değiştirmemesi gereken alanlar (sayaçlar,
  hesap/moderasyon durumu, öne çıkarma) sütun yetkileriyle kapalıdır.
- **Doğum tarihi saklanmaz.** Profil oluşturulurken sunucuda 18 yaş kontrolü
  yapılır; yalnızca doğrulama zamanı tutulur.
- **Kullanıcı adları** yalnızca küçük İngilizce harf, rakam, nokta ve alt çizgi
  içerir; büyük/küçük harf farkı yok sayılır, 30 günde bir değiştirilebilir. Arama
  Türkçe karakterleri karşılıklarına çevirir (“çağrı” → “cagri”). Görünen ad
  Türkçe karakter içerebilir ve zorunludur.
- **Fotoğraflar** özel depolarda tutulur ve kısa süreli imzalı bağlantılarla
  sunulur; okuma yetkisi kombinin görünürlüğüne bağlıdır. Yüklemeden önce JPEG'e
  yeniden kodlanarak EXIF/konum bilgisi silinir; depo yalnızca `image/jpeg` kabul eder.
- **Gardırop özeldir.** Başkaları yalnızca görebildikleri bir kombine bağlı
  parçaların adını, kategorisini, rengini ve markasını görür; fiyat, tarih ve
  notlar paylaşılmaz.
- **Keşfet sıralaması** şartname §10.2'deki başlangıç ağırlıklarını kullanır
  (stil uyumu 30, ilgi benzerliği 25, takip 20, güncellik 15, çeşitlilik 10); bir
  sayfada aynı kişiden en fazla 2 kombin gösterilir ve yeni üreticilere pay
  ayrılır. Ağırlıklar gerçek kullanım verisiyle ayarlanmalıdır.
- **Örnek içerikler** yönetim panelinden işaretlenir ve uygulamada “LOOK örnek
  kombin” olarak etiketlenir; gerçek kullanıcı içeriğiyle karıştırılmaz.
- **Kötüye kullanım sınırları:** yorum (dakikada 10, tekrar engeli), takip (saatte
  200), paylaşım (saatte 30), şikâyet (günde 20, aynı hedefe tekrar yok).
- **Hesap silme** e-posta hesaplarında parola doğrulaması ister; depolama
  dosyaları ve kimlik kaydı Edge Function ile silinir, şikâyet ve işlem
  kayıtlarındaki kullanıcı referansı anonimleşir.

## Durum

| Kapsam | Özellik | Durum |
| --- | --- | --- |
| P0 | Kayıt, giriş, çıkış, parola sıfırlama, e-posta doğrulama | Hazır |
| P0 | Profil oluşturma/düzenleme, gizli hesap, stil etiketleri | Hazır |
| P0 | Kombin paylaşma (başlık, açıklama, etiketler, görünürlük), düzenleme, silme, fotoğraf sırası | Hazır |
| P0 | Ana Sayfa, Keşfet (filtreler, öne çıkanlar, öneriler), arama | Hazır |
| P0 | Takip ve takip istekleri, beğeni, yorum, kaydetme, profil ızgarası | Hazır |
| P0 | Engelleme, şikâyet, bildirimler ve tercihleri, hesap silme | Hazır |
| P0 | Güvenli veritabanı ve fotoğraf depolama | Hazır (121 yetkilendirme kontrolü: `supabase/tests`) |
| P0 | Yönetici moderasyon araçları (web paneli, roller, iki adımlı doğrulama, işlem günlüğü) | Hazır |
| P1 | Dijital gardırop, gardıroptan kombin, koleksiyonlar | Hazır |
| P1 | Apple ve Google ile giriş, push bildirimleri | Hazır (sağlayıcı ve EAS ayarları gerekli) |
| P1 | Kişiselleştirilmiş keşfet, gelişmiş stil filtreleri | Başlangıç sürümü hazır |
| P1 | Profil stil özeti, gelişmiş fotoğraf düzenleme | Yapılacak |
| — | Paylaşım bağlantıları için web önizleme sayfaları ve Universal/App Links | Yapılacak (`EXPO_PUBLIC_WEB_URL`) |
| — | Hata takibi (Sentry), ürün analitiği, çoklu dil altyapısı | Yapılacak |
| — | Sunucu tarafında EXIF temizleme (istemciyi atlayan yüklemeler için) | Yapılacak |
| — | Yasal metinler (KVKK, kullanım şartları) | Hukuki destekle hazırlanmalı; `constants/links.ts` adresleri yer tutucudur |
| P2 | Yapay zekâ stil asistanı, hava durumu önerileri, sanal deneme, LOOK Plus | Kapsam dışı |

Kod gerçek bir Supabase projesine ve fiziksel cihazlara karşı henüz test
edilmedi; yayından önce şartname §22'deki kabul testleri cihazlarda yapılmalıdır.
