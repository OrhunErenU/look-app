-- Yetkilendirme ve veri bütünlüğü testleri.
-- supabase/tests/run.sh ile boş bir veritabanında çalıştırılır.
\set ON_ERROR_STOP on
\set QUIET on

create schema test;
grant usage on schema test to authenticated;

create function test.expect(ok boolean, label text) returns void language plpgsql as $$
begin
  if ok is not true then
    raise exception 'BAŞARISIZ: %', label;
  end if;
  raise notice 'ok - %', label;
end;
$$;

create function test.expect_error(stmt text, label text) returns void language plpgsql as $$
begin
  begin
    execute stmt;
  exception when others then
    raise notice 'ok - % (%)', label, sqlerrm;
    return;
  end;
  raise exception 'BAŞARISIZ (hata bekleniyordu): %', label;
end;
$$;

create function test.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, false);
  set role authenticated;
end;
$$;

grant execute on all functions in schema test to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@example.com'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@example.com'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@example.com'),
  ('00000000-0000-0000-0000-00000000000d', 'dave@example.com'),
  ('00000000-0000-0000-0000-00000000000e', 'erin@example.com'),
  ('00000000-0000-0000-0000-0000000000ff', 'mod@example.com');

\set alice '\'00000000-0000-0000-0000-00000000000a\''
\set bob '\'00000000-0000-0000-0000-00000000000b\''
\set carol '\'00000000-0000-0000-0000-00000000000c\''
\set dave '\'00000000-0000-0000-0000-00000000000d\''
\set erin '\'00000000-0000-0000-0000-00000000000e\''
\set mod '\'00000000-0000-0000-0000-0000000000ff\''

-- Profil oluşturma ------------------------------------------------------------
select test.as_user(:alice);
select username = 'alice' from public.create_profile('Alice', 'Alice', 'Minimal seven biri', '1998-03-01', array['minimal', 'casual']);
select test.as_user(:bob);
select public.create_profile('bob', null, null, '1999-05-05');
select test.as_user(:carol);
select public.create_profile('carol', 'Carol', null, '2000-01-01', array['minimal']);
select test.as_user(:dave);
select public.create_profile('dave', null, null, '2001-01-01');
select test.as_user(:mod);
select public.create_profile('moderator', null, null, '1990-01-01');

select test.as_user(:erin);
select test.expect_error($$ select public.create_profile('ALICE', null, null, '1995-01-01') $$,
  'büyük/küçük harf farkıyla aynı kullanıcı adı alınamaz');
select test.expect_error($$ select public.create_profile('erin', null, null, (current_date - interval '17 years')::date) $$,
  '18 yaş altı kayıt reddedilir');
select test.expect_error($$ select public.create_profile('a', null, null, '1995-01-01') $$,
  'geçersiz kullanıcı adı biçimi reddedilir');
select test.expect(public.is_username_available('Erin'), 'boş kullanıcı adı müsait görünür');
select test.expect(not public.is_username_available('ALICE'), 'alınmış kullanıcı adı büyük harfle de dolu görünür');

reset role;
insert into public.staff (user_id, role) values (:mod, 'moderator');

-- Bob gizli hesap
select test.as_user(:bob);
update public.profiles set is_private = true where id = auth.uid();

-- Alice başkasının profilini değiştiremez
select test.as_user(:alice);
update public.profiles set bio = 'hacked' where id = :bob;
reset role;
select test.expect((select bio from public.profiles where id = :bob) is null, 'başkasının profili gerçekten değişmedi');
select test.as_user(:alice);
select test.expect_error($$ update public.profiles set follower_count = 999 where id = auth.uid() $$,
  'sayaç alanları istemciden değiştirilemez');
select test.expect_error($$ update public.profiles set account_status = 'active' where id = auth.uid() $$,
  'hesap durumu istemciden değiştirilemez');
select test.expect((select count(*) from public.account_private) = 1, 'yalnızca kendi doğum tarihini görür');

-- Gönderiler ------------------------------------------------------------------
select test.as_user(:alice);
select public.create_post(
  '10000000-0000-0000-0000-000000000001', 'Sonbahar için sade bir kombin.', 'public', true,
  '{"top": "Bej triko"}', array['minimal', 'casual', 'olmayan-stil'],
  '[{"storage_path": "00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/0.jpg",
     "thumb_path": "00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/0_t.jpg",
     "width": 1080, "height": 1350}]'
);
select public.create_post(
  '10000000-0000-0000-0000-000000000002', 'Sadece bana', 'private', true, '{}', '{}',
  '[{"storage_path": "00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000002/0.jpg",
     "thumb_path": "00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000002/0_t.jpg",
     "width": 1080, "height": 1350}]'
);
select test.expect((select count(*) from public.post_styles where post_id = '10000000-0000-0000-0000-000000000001') = 2,
  'yalnızca tanımlı stiller eklenir');
select test.expect_error($$
  select public.create_post('10000000-0000-0000-0000-000000000003', '', 'public', true, '{}', '{}',
    '[{"storage_path": "00000000-0000-0000-0000-00000000000b/x/0.jpg", "thumb_path": "00000000-0000-0000-0000-00000000000b/x/0_t.jpg", "width": 1, "height": 1}]')
$$, 'başkasının klasöründeki görsel kullanılamaz');
select test.expect_error($$
  select public.create_post('10000000-0000-0000-0000-000000000004', '', 'public', true, '{}', '{}', '[]')
$$, 'görselsiz paylaşım reddedilir');
select test.expect_error($$
  insert into public.posts (user_id, caption) values (auth.uid(), 'doğrudan')
$$, 'posts tablosuna doğrudan yazılamaz');

select test.as_user(:bob);
select public.create_post(
  '20000000-0000-0000-0000-000000000001', 'Bob takipçilere', 'followers', true, '{}', '{}',
  '[{"storage_path": "00000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000001/0.jpg",
     "thumb_path": "00000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000001/0_t.jpg",
     "width": 1080, "height": 1080}]'
);
select public.create_post(
  '20000000-0000-0000-0000-000000000002', 'Bob herkese açık ama hesap gizli', 'public', true, '{}', '{}',
  '[{"storage_path": "00000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000002/0.jpg",
     "thumb_path": "00000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000002/0_t.jpg",
     "width": 1080, "height": 1080}]'
);

reset role;
insert into storage.objects (bucket_id, name) values
  ('post-images', '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/0.jpg'),
  ('post-images', '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000002/0.jpg'),
  ('post-images', '00000000-0000-0000-0000-00000000000b/20000000-0000-0000-0000-000000000001/0.jpg');

select test.as_user(:carol);
select test.expect((select count(*) from public.posts where user_id = :alice) = 1, 'herkese açık gönderi görünür, özel gönderi görünmez');
select test.expect((select count(*) from public.post_images where post_id = '10000000-0000-0000-0000-000000000002') = 0, 'özel gönderinin görselleri görünmez');
select test.expect((select count(*) from public.posts where user_id = :bob) = 0, 'gizli hesabın gönderileri takipsiz görünmez');
select test.expect((select count(*) from public.profiles where id = :bob) = 1, 'gizli hesap profili aramada görünür');
select test.expect((select count(*) from storage.objects where name like '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000001/%') = 1,
  'herkese açık gönderinin dosyası okunabilir');
select test.expect((select count(*) from storage.objects where name like '00000000-0000-0000-0000-00000000000a/10000000-0000-0000-0000-000000000002/%') = 0,
  'özel gönderinin dosyası okunamaz');
select test.expect((select count(*) from storage.objects where name like '00000000-0000-0000-0000-00000000000b/%') = 0,
  'gizli hesabın dosyaları okunamaz');

update public.posts set caption = 'hacked' where id = '10000000-0000-0000-0000-000000000001';
delete from public.posts where id = '10000000-0000-0000-0000-000000000001';
reset role;
select test.expect((select caption from public.posts where id = '10000000-0000-0000-0000-000000000001') = 'Sonbahar için sade bir kombin.',
  'başkasının gönderisi düzenlenemez ve silinemez');

-- Takip -----------------------------------------------------------------------
select test.as_user(:carol);
select test.expect(public.follow_user(:bob) = 'pending', 'gizli hesaba takip isteği bekler');
select test.expect(public.follow_user(:alice) = 'accepted', 'açık hesap doğrudan takip edilir');
select test.expect_error($$ select public.follow_user(auth.uid()) $$, 'kendini takip edemez');
select test.expect((select count(*) from public.posts where user_id = :bob) = 0, 'bekleyen istek içerik açmaz');

select test.as_user(:dave);
select public.respond_follow_request(:carol, true);
reset role;
select test.expect((select status from public.follows where follower_id = :carol and following_id = :bob) = 'pending',
  'başkası adına istek kabul edilemez');

select test.as_user(:bob);
select test.expect((select count(*) from public.notifications where type = 'follow_request') = 1, 'takip isteği bildirimi oluşur');
select public.respond_follow_request(:carol, true);
select test.expect((select follower_count from public.profiles where id = :bob) = 1, 'takipçi sayısı sunucuda güncellenir');

select test.as_user(:carol);
select test.expect((select count(*) from public.posts where user_id = :bob) = 2, 'onaylı takipçi gizli hesabın gönderilerini görür');
select test.expect((select count(*) from public.home_feed()) = 3, 'ana sayfa takip edilenlerin gönderilerini içerir');
select test.expect((select count(*) from public.notifications where type = 'follow_accepted') = 1, 'kabul bildirimi gelir');

select test.as_user(:dave);
select test.expect((select count(*) from public.explore_feed()) = 1, 'keşfet yalnızca açık hesapların açık gönderilerini içerir');
select test.expect((select count(*) from public.explore_feed('vintage')) = 0, 'stil filtresi çalışır');
select test.expect((select count(*) from public.search_profiles('ali')) = 1, 'kullanıcı adıyla arama');
select test.expect((select count(*) from public.search_profiles('@ALICE')) = 1, '@ ve büyük harfle arama');

-- Beğeni, kaydetme, yorum --------------------------------------------------------
select test.as_user(:carol);
insert into public.likes (user_id, post_id) values (auth.uid(), '10000000-0000-0000-0000-000000000001');
select test.expect_error($$ insert into public.likes (user_id, post_id) values (auth.uid(), '10000000-0000-0000-0000-000000000001') $$,
  'aynı beğeni iki kez kaydedilemez');
select test.expect_error($$ insert into public.likes (user_id, post_id) values ('00000000-0000-0000-0000-00000000000d', '10000000-0000-0000-0000-000000000001') $$,
  'başkası adına beğeni yapılamaz');
select test.expect_error($$ insert into public.likes (user_id, post_id) values (auth.uid(), '10000000-0000-0000-0000-000000000002') $$,
  'görülemeyen gönderi beğenilemez');
insert into public.saved_posts (user_id, post_id) values (auth.uid(), '10000000-0000-0000-0000-000000000001');
insert into public.comments (post_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Çok güzel olmuş!');
select test.expect_error($$ insert into public.comments (post_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), 'Çok güzel olmuş!') $$,
  'aynı yorum kısa sürede tekrar gönderilemez');
select test.expect_error($$ insert into public.comments (post_id, user_id, body) values ('10000000-0000-0000-0000-000000000001', auth.uid(), '   ') $$,
  'boş yorum reddedilir');

select test.as_user(:dave);
select test.expect((select count(*) from public.saved_posts) = 0, 'kaydedilenler yalnızca sahibine görünür');
update public.comments set body = 'değiştirildi';
reset role;
select test.expect((select body from public.comments limit 1) = 'Çok güzel olmuş!', 'başkasının yorumu düzenlenemez');

select test.as_user(:alice);
select test.expect((select like_count from public.posts where id = '10000000-0000-0000-0000-000000000001') = 1, 'beğeni sayısı tutarlı');
select test.expect((select comment_count from public.posts where id = '10000000-0000-0000-0000-000000000001') = 1, 'yorum sayısı tutarlı');
select test.expect((select count(*) from public.notifications where type in ('like', 'comment', 'follow')) = 3, 'beğeni, yorum ve takip bildirimleri doğru kişiye gider');
select test.as_user(:bob);
select test.expect((select count(*) from public.notifications where type in ('like', 'comment')) = 0, 'başkasının bildirimleri görünmez');

-- Gönderi sahibi yorumu silebilir; yanıtlar korunur
select test.as_user(:alice);
select public.delete_comment((select id from public.comments limit 1));
select test.expect((select comment_count from public.posts where id = '10000000-0000-0000-0000-000000000001') = 0, 'silinen yorum sayaçtan düşer');

-- Engelleme -------------------------------------------------------------------
select test.as_user(:alice);
select public.block_user(:carol);
select test.as_user(:carol);
select test.expect((select count(*) from public.posts where user_id = :alice) = 0, 'engellenen kişi gönderileri göremez');
select test.expect((select count(*) from public.profiles where id = :alice) = 0, 'engellenen kişi profili göremez');
select test.expect((select count(*) from public.search_profiles('alice')) = 0, 'engellenen kişi aramada görünmez');
select test.expect((select count(*) from storage.objects where name like '00000000-0000-0000-0000-00000000000a/%') = 0, 'engellenen kişi dosyaları okuyamaz');
select test.expect_error($$ select public.follow_user('00000000-0000-0000-0000-00000000000a') $$, 'engellenen kişi takip edemez');
select test.expect((select count(*) from public.follows where following_id = :alice or follower_id = :alice) = 0, 'engelleme takip ilişkisini sonlandırır');
select test.as_user(:dave);
select test.expect(not public.is_blocked_between(:alice, :carol), 'üçüncü kişiler arasındaki engelleme sorgulanamaz');
select test.expect(not public.is_approved_follower(:carol, :bob), 'üçüncü kişilerin takip ilişkisi yardımcı fonksiyonla sorgulanamaz');
select test.as_user(:alice);
select test.expect((select count(*) from public.profiles where id = :carol) = 0, 'engelleyen de engellenen profili görmez');
select test.expect((select username from public.my_blocked_users()) = 'carol', 'engellenenler listesi ayarlarda görünür');
select test.as_user(:carol);
select test.expect((select count(*) from public.my_blocked_users()) = 0, 'engellenen kişi engelleyeni listede görmez');

-- Şikâyet ve moderasyon ---------------------------------------------------------
select test.as_user(:dave);
insert into public.reports (reporter_id, post_id, reason, details)
values (auth.uid(), '10000000-0000-0000-0000-000000000001', 'spam', 'deneme');
select test.expect((select count(*) from public.reports) = 0, 'kullanıcı şikâyetleri okuyamaz');
select test.expect_error($$ select public.admin_set_post_status('10000000-0000-0000-0000-000000000001', 'removed') $$,
  'normal kullanıcı yönetim fonksiyonu çağıramaz');
select test.expect_error($$ insert into public.staff (user_id, role) values (auth.uid(), 'admin') $$,
  'kullanıcı kendini yönetici yapamaz');

select test.as_user(:mod);
select test.expect((select count(*) from public.reports) = 1, 'moderatör şikâyetleri görür');
select public.admin_set_post_status('10000000-0000-0000-0000-000000000001', 'removed', 'spam',
  (select id from public.reports limit 1));
select public.admin_resolve_report((select id from public.reports limit 1), 'actioned');
select test.expect_error($$ select public.admin_set_account_status('00000000-0000-0000-0000-00000000000d', 'banned') $$,
  'hesap kapatma yalnızca admin yetkisiyle');
select test.expect((select count(*) from public.moderation_actions) = 2, 'yönetim işlemleri kayıt altına alınır');

select test.as_user(:dave);
select test.expect((select count(*) from public.posts where id = '10000000-0000-0000-0000-000000000001') = 0, 'kaldırılan içerik görünmez');
select test.expect((select count(*) from public.explore_feed()) = 0, 'kaldırılan içerik keşfette yer almaz');

-- Silme -----------------------------------------------------------------------
select test.as_user(:bob);
delete from public.posts where id = '20000000-0000-0000-0000-000000000001';
select test.expect((select post_count from public.profiles where id = auth.uid()) = 1, 'gönderi silinince sayaç düşer');

reset role;
delete from auth.users where id = :dave;
select test.expect(not exists (select 1 from public.profiles where id = :dave), 'hesap silinince profil silinir');
select test.expect(not exists (select 1 from public.reports where reporter_id is not null and reporter_id = :dave), 'silinen hesabın şikâyet kaydı anonimleşir');

\echo 'Tüm veritabanı testleri geçti.'
