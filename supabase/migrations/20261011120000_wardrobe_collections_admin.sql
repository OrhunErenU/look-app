-- LOOK ürün şartnamesi v2 değişiklikleri
--
-- * Doğum tarihi saklanmaz; yalnızca yaş doğrulamasının yapıldığı kaydedilir.
-- * Görünen ad zorunludur; kullanıcı adı 30 günde bir değiştirilebilir.
-- * Kombin başlığı, profilde öne çıkarma, stil/mevsim/kullanım alanı etiketleri.
-- * Dijital gardırop (wardrobe_items) ve kombin-parça ilişkisi (post_items).
-- * Koleksiyonlar (collections, collection_posts).
-- * Yeni keşfet puanlaması, ağ (arkadaşların takip ettikleri) akışı, benzer
--   kombinler, kombin ve koleksiyon araması.
-- * Push bildirimleri için cihaz belirteçleri.
-- * Yönetici rolleri (destek < moderatör < yönetici < sistem sahibi), yönetici
--   işlemleri için iki adımlı doğrulama (aal2) zorunluluğu, uygulama ayarları,
--   öne çıkan ve örnek içerikler, şikâyet sınırları.

-- ---------------------------------------------------------------------------
-- Yaş doğrulaması: doğum tarihi saklanmaz
-- ---------------------------------------------------------------------------

alter table public.account_private drop column birth_date;
alter table public.account_private add column age_verified_at timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- Profiller
-- ---------------------------------------------------------------------------

alter table public.profiles
  add constraint display_name_present check (char_length(btrim(display_name)) between 1 and 50) not valid;
alter table public.profiles validate constraint display_name_present;
alter table public.profiles alter column display_name set not null;
alter table public.profiles add column username_changed_at timestamptz;

create function public.guard_username_change()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.username is distinct from old.username then
    if old.username_changed_at is not null and old.username_changed_at > now() - interval '30 days' then
      raise exception 'Kullanıcı adını 30 günde bir değiştirebilirsin.' using errcode = 'P0001';
    end if;
    new.username_changed_at = now();
  end if;
  return new;
end;
$$;

create trigger profiles_username_change before update of username on public.profiles
  for each row execute function public.guard_username_change();

-- ---------------------------------------------------------------------------
-- Etiketler: stil, mevsim ve kullanım alanı
-- ---------------------------------------------------------------------------

alter table public.styles add column kind text not null default 'style'
  check (kind in ('style', 'season', 'occasion'));

update public.styles set name = 'Günlük', sort_order = 1 where slug = 'casual';
update public.styles set name = 'Minimalist' where slug = 'minimal';
update public.styles set name = 'Sportif' where slug = 'sporty';
update public.styles set name = 'Resmî' where slug = 'formal';
update public.styles set sort_order = 0 where slug = 'streetwear';

insert into public.styles (slug, name, kind, sort_order) values
  ('spring', 'İlkbahar', 'season', 1),
  ('summer', 'Yazlık', 'season', 2),
  ('autumn', 'Sonbahar', 'season', 3),
  ('winter', 'Kışlık', 'season', 4),
  ('university', 'Üniversite', 'occasion', 1),
  ('night-out', 'Gece dışarı çıkma', 'occasion', 2),
  ('special-day', 'Özel gün', 'occasion', 3),
  ('work', 'İş', 'occasion', 4),
  ('date', 'Buluşma', 'occasion', 5),
  ('travel', 'Seyahat', 'occasion', 6);

-- ---------------------------------------------------------------------------
-- Kombinler: başlık, öne çıkarma, editör seçimi ve örnek içerik
-- ---------------------------------------------------------------------------

alter table public.posts
  add column title text not null default '' constraint title_length check (char_length(title) <= 80),
  add column pinned_at timestamptz,
  -- Yönetim panelinden keşfette öne çıkarılan içerik.
  add column featured_at timestamptz,
  -- LOOK ekibinin hazırladığı örnek içerik; uygulamada ayrıca etiketlenir ve
  -- gerçek kullanıcı içeriğiyle karıştırılmaz.
  add column is_sample boolean not null default false;

create index posts_title_trgm on public.posts using gin (lower(title) extensions.gin_trgm_ops);
create index posts_featured on public.posts (featured_at desc) where featured_at is not null;

grant update (title, pinned_at) on public.posts to authenticated;

create function public.guard_pins()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.pinned_at is not null and old.pinned_at is null
     and (select count(*) from public.posts where user_id = new.user_id and pinned_at is not null) >= 3 then
    raise exception 'Profilinde en fazla 3 kombini öne çıkarabilirsin.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger posts_pins before update of pinned_at on public.posts
  for each row execute function public.guard_pins();

-- ---------------------------------------------------------------------------
-- Dijital gardırop
-- ---------------------------------------------------------------------------

create type public.wardrobe_category as enum (
  'top', 'bottom', 'outerwear', 'shoes', 'bag', 'accessory', 'one_piece'
);
create type public.wardrobe_status as enum ('active', 'archived');

create table public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null constraint name_length check (char_length(btrim(name)) between 1 and 80),
  category public.wardrobe_category not null,
  color text check (char_length(color) <= 30),
  style_id smallint references public.styles (id) on delete set null,
  seasons text[] not null default '{}'
    check (seasons <@ array['spring', 'summer', 'autumn', 'winter']),
  brand text check (char_length(brand) <= 60),
  purchase_price numeric(10, 2) check (purchase_price >= 0),
  purchase_date date,
  notes text check (char_length(notes) <= 300),
  photo_path text,
  thumb_path text,
  status public.wardrobe_status not null default 'active',
  wear_count integer not null default 0 check (wear_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint photo_pair check ((photo_path is null) = (thumb_path is null))
);

create index wardrobe_items_user on public.wardrobe_items (user_id, status, category, created_at desc);

create trigger wardrobe_items_touch before update on public.wardrobe_items
  for each row execute function public.touch_updated_at();

-- Fotoğraf yolu kullanıcının kendi klasöründe olmalıdır.
create function public.guard_wardrobe_item()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if new.photo_path is not null and (
    left(new.photo_path, length(new.user_id::text) + 1) <> new.user_id::text || '/'
    or left(new.thumb_path, length(new.user_id::text) + 1) <> new.user_id::text || '/'
  ) then
    raise exception 'Geçersiz görsel yolu.' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and (select count(*) from public.wardrobe_items where user_id = new.user_id) >= 1000 then
    raise exception 'Gardırobuna en fazla 1000 parça ekleyebilirsin.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger wardrobe_items_guard before insert or update of photo_path, thumb_path on public.wardrobe_items
  for each row execute function public.guard_wardrobe_item();

create table public.post_items (
  post_id uuid not null references public.posts (id) on delete cascade,
  item_id uuid not null references public.wardrobe_items (id) on delete cascade,
  position smallint not null default 0,
  primary key (post_id, item_id)
);

create index post_items_item on public.post_items (item_id);

-- Kullanım sıklığı: parçanın kaç kombinde kullanıldığı.
create function public.on_post_item_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.wardrobe_items set wear_count = wear_count + 1 where id = new.item_id;
  else
    update public.wardrobe_items set wear_count = greatest(wear_count - 1, 0) where id = old.item_id;
  end if;
  return null;
end;
$$;

create trigger post_items_count after insert or delete on public.post_items
  for each row execute function public.on_post_item_change();

-- ---------------------------------------------------------------------------
-- Koleksiyonlar
-- ---------------------------------------------------------------------------

create type public.collection_visibility as enum ('private', 'followers', 'public');

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null constraint name_length check (char_length(btrim(name)) between 1 and 50),
  description text check (char_length(description) <= 200),
  visibility public.collection_visibility not null default 'private',
  post_count integer not null default 0 check (post_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index collections_user on public.collections (user_id, updated_at desc);
create index collections_name_trgm on public.collections using gin (lower(name) extensions.gin_trgm_ops);

create trigger collections_touch before update on public.collections
  for each row execute function public.touch_updated_at();

create table public.collection_posts (
  collection_id uuid not null references public.collections (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  added_at timestamptz not null default now(),
  primary key (collection_id, post_id)
);

create index collection_posts_post on public.collection_posts (post_id);

create function public.guard_collection_insert()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if (select count(*) from public.collections where user_id = new.user_id) >= 100 then
    raise exception 'En fazla 100 koleksiyon oluşturabilirsin.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

create trigger collections_guard before insert on public.collections
  for each row execute function public.guard_collection_insert();

create function public.on_collection_post_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.collections set post_count = post_count + 1, updated_at = now() where id = new.collection_id;
  else
    update public.collections set post_count = greatest(post_count - 1, 0) where id = old.collection_id;
  end if;
  return null;
end;
$$;

create trigger collection_posts_count after insert or delete on public.collection_posts
  for each row execute function public.on_collection_post_change();

-- ---------------------------------------------------------------------------
-- Push bildirimleri ve uygulama ayarları
-- ---------------------------------------------------------------------------

create table public.device_tokens (
  token text primary key check (char_length(token) <= 255),
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create index device_tokens_user on public.device_tokens (user_id);

-- Duyuru, bakım modu ve özellik bayrakları. Yalnızca yöneticiler değiştirir.
create table public.app_settings (
  key text primary key check (key ~ '^[a-z_]{2,40}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles (id) on delete set null
);

insert into public.app_settings (key, value) values
  ('announcement', 'null'),
  ('maintenance', '{"enabled": false, "message": ""}'),
  ('features', '{"wardrobe": true, "collections": true}');

-- ---------------------------------------------------------------------------
-- Yönetici rolleri ve iki adımlı doğrulama
-- ---------------------------------------------------------------------------

alter type public.staff_role add value if not exists 'support' before 'moderator';
alter type public.staff_role add value if not exists 'owner' after 'admin';

-- Personel yetkileri yalnızca iki adımlı doğrulamayla açılmış oturumlarda
-- geçerlidir. Aynı kişi telefonda normal oturumla normal kullanıcı gibi davranır.
-- 0: yetki yok, 1: destek, 2: moderatör, 3: yönetici, 4: sistem sahibi.
create function public.staff_level()
returns integer
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select case s.role::text
      when 'support' then 1 when 'moderator' then 2 when 'admin' then 3 when 'owner' then 4 else 0 end
    from public.staff s
    where s.user_id = auth.uid()
      and coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
  ), 0);
$$;

create or replace function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select public.staff_level() >= 1;
$$;

create function public.require_staff_level(min_level integer)
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if public.staff_level() < min_level then
    raise exception 'Yetkisiz işlem.' using errcode = '42501';
  end if;
end;
$$;

-- Panelin oturum açan kişinin rolünü öğrenmesi için. İki adımlı doğrulama
-- yapılmamışsa rol yine döner; panel bu durumda doğrulama ister.
create function public.my_staff_role()
returns text
language sql stable security definer set search_path = ''
as $$
  select role::text from public.staff where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Görünürlük yardımcıları
-- ---------------------------------------------------------------------------

create function public.can_view_collection_row(owner uuid, vis public.collection_visibility)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when owner = auth.uid() then true
    when public.is_staff() then true
    when vis = 'private' then false
    when not public.can_see_profile(owner) then false
    when vis = 'followers' then public.is_approved_follower(auth.uid(), owner)
    else not (select is_private from public.profiles where id = owner)
      or public.is_approved_follower(auth.uid(), owner)
  end;
$$;

create function public.can_read_wardrobe_object(object_name text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (storage.foldername(object_name))[1] = auth.uid()::text then
    return true;
  end if;
  -- Başkasının parça fotoğrafı yalnızca görüntülenebilen bir kombine bağlıysa okunur.
  return exists (
    select 1
    from public.wardrobe_items w
    join public.post_items pi on pi.item_id = w.id
    where (w.photo_path = object_name or w.thumb_path = object_name)
      and public.can_view_post(pi.post_id)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.wardrobe_items enable row level security;
alter table public.post_items enable row level security;
alter table public.collections enable row level security;
alter table public.collection_posts enable row level security;
alter table public.device_tokens enable row level security;
alter table public.app_settings enable row level security;

revoke all on public.wardrobe_items, public.post_items, public.collections, public.collection_posts,
  public.device_tokens, public.app_settings from anon, authenticated;

-- Gardırop özeldir. Başka bir kullanıcı yalnızca görüntüleyebildiği bir kombine
-- bağlı parçaların özetini post_item_details fonksiyonuyla görür (fiyat ve
-- satın alma tarihi gibi alanlar paylaşılmaz).
create policy "wardrobe_items: yalnızca sahibi" on public.wardrobe_items
  for select to authenticated using (user_id = auth.uid() or public.is_staff());
create policy "wardrobe_items: sahibi ekler" on public.wardrobe_items
  for insert to authenticated with check (user_id = auth.uid());
create policy "wardrobe_items: sahibi günceller" on public.wardrobe_items
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "wardrobe_items: sahibi siler" on public.wardrobe_items
  for delete to authenticated using (user_id = auth.uid());
grant select on public.wardrobe_items to authenticated;
grant insert (id, user_id, name, category, color, style_id, seasons, brand, purchase_price, purchase_date,
  notes, photo_path, thumb_path, status) on public.wardrobe_items to authenticated;
grant update (name, category, color, style_id, seasons, brand, purchase_price, purchase_date, notes,
  photo_path, thumb_path, status) on public.wardrobe_items to authenticated;
grant delete on public.wardrobe_items to authenticated;

create policy "post_items: gönderi görünürse" on public.post_items
  for select to authenticated using (public.can_view_post(post_id));
grant select on public.post_items to authenticated;

create policy "collections: görünür koleksiyonlar" on public.collections
  for select to authenticated using (public.can_view_collection_row(user_id, visibility));
create policy "collections: sahibi oluşturur" on public.collections
  for insert to authenticated with check (user_id = auth.uid());
create policy "collections: sahibi günceller" on public.collections
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "collections: sahibi siler" on public.collections
  for delete to authenticated using (user_id = auth.uid());
grant select on public.collections to authenticated;
grant insert (id, user_id, name, description, visibility) on public.collections to authenticated;
grant update (name, description, visibility) on public.collections to authenticated;
grant delete on public.collections to authenticated;

create policy "collection_posts: koleksiyon ve gönderi görünürse" on public.collection_posts
  for select to authenticated using (
    public.can_view_post(post_id)
    and exists (
      select 1 from public.collections c
      where c.id = collection_id and public.can_view_collection_row(c.user_id, c.visibility)
    )
  );
create policy "collection_posts: sahibi ekler" on public.collection_posts
  for insert to authenticated with check (
    public.can_view_post(post_id)
    and exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );
create policy "collection_posts: sahibi çıkarır" on public.collection_posts
  for delete to authenticated using (
    exists (select 1 from public.collections c where c.id = collection_id and c.user_id = auth.uid())
  );
grant select, insert (collection_id, post_id), delete on public.collection_posts to authenticated;

create policy "device_tokens: sahibi" on public.device_tokens
  for select to authenticated using (user_id = auth.uid());
create policy "device_tokens: sahibi ekler" on public.device_tokens
  for insert to authenticated with check (user_id = auth.uid());
create policy "device_tokens: sahibi siler" on public.device_tokens
  for delete to authenticated using (user_id = auth.uid());
grant select, insert (token, user_id, platform), delete on public.device_tokens to authenticated;

create policy "app_settings: herkes okur" on public.app_settings
  for select to anon, authenticated using (true);
grant select on public.app_settings to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Şikâyet sınırları
-- ---------------------------------------------------------------------------

create function public.guard_report_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (select count(*) from public.reports
      where reporter_id = new.reporter_id and created_at > now() - interval '1 day') >= 20 then
    raise exception 'Bugün çok fazla şikâyet gönderdin. Yarın tekrar deneyebilirsin.' using errcode = 'P0429';
  end if;
  if exists (
    select 1 from public.reports
    where reporter_id = new.reporter_id
      and status in ('open', 'in_review')
      and reported_user_id is not distinct from new.reported_user_id
      and post_id is not distinct from new.post_id
      and comment_id is not distinct from new.comment_id
  ) then
    raise exception 'Bunu zaten şikâyet ettin; ekibimiz inceliyor.' using errcode = 'P0409';
  end if;
  return new;
end;
$$;

create trigger reports_guard before insert on public.reports
  for each row execute function public.guard_report_insert();

-- ---------------------------------------------------------------------------
-- Profil oluşturma: doğum tarihi yalnızca doğrulanır, saklanmaz
-- ---------------------------------------------------------------------------

create or replace function public.create_profile(
  p_username text,
  p_display_name text,
  p_bio text,
  p_birth_date date,
  p_style_slugs text[] default '{}'
)
returns public.profiles
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result public.profiles;
begin
  if uid is null then
    raise exception 'Oturum bulunamadı.' using errcode = '42501';
  end if;
  if p_birth_date is null or p_birth_date < date '1900-01-01' or p_birth_date > current_date then
    raise exception 'Geçerli bir doğum tarihi gir.' using errcode = '22023';
  end if;
  if p_birth_date > (current_date - interval '18 years')::date then
    raise exception 'LOOK şu an yalnızca 18 yaş ve üzeri kullanıcılara açık.' using errcode = '22023';
  end if;
  if nullif(btrim(p_display_name), '') is null then
    raise exception 'Görünen ad gerekli.' using errcode = '22023';
  end if;

  insert into public.profiles (id, username, display_name, bio)
  values (uid, lower(btrim(p_username)), btrim(p_display_name), nullif(btrim(p_bio), ''))
  returning * into result;

  insert into public.account_private (user_id) values (uid);
  insert into public.notification_settings (user_id) values (uid);
  insert into public.user_styles (user_id, style_id)
    select uid, s.id from public.styles s where s.slug = any (p_style_slugs) and s.is_active;

  return result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Kombin oluşturma ve düzenleme
-- ---------------------------------------------------------------------------

drop function public.create_post(uuid, text, public.post_visibility, boolean, jsonb, text[], jsonb);
drop function public.set_post_styles(uuid, text[]);

create function public.attach_post_items(p_post_id uuid, p_item_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  owner uuid;
begin
  select user_id into owner from public.posts where id = p_post_id;
  if owner is null or owner <> auth.uid() then
    raise exception 'Bu kombini düzenleme yetkin yok.' using errcode = '42501';
  end if;
  if coalesce(array_length(p_item_ids, 1), 0) > 20 then
    raise exception 'Bir kombine en fazla 20 parça bağlanabilir.' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(coalesce(p_item_ids, '{}')) as i(id)
    where not exists (select 1 from public.wardrobe_items w where w.id = i.id and w.user_id = owner)
  ) then
    raise exception 'Yalnızca kendi gardırobundaki parçaları ekleyebilirsin.' using errcode = '42501';
  end if;

  delete from public.post_items where post_id = p_post_id and item_id <> all (coalesce(p_item_ids, '{}'));
  insert into public.post_items (post_id, item_id, position)
    select p_post_id, i.id, (i.ord - 1)::smallint
    from unnest(coalesce(p_item_ids, '{}')) with ordinality as i(id, ord)
  on conflict (post_id, item_id) do update set position = excluded.position;
end;
$$;

create function public.set_post_styles(p_post_id uuid, p_style_slugs text[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.posts where id = p_post_id and user_id = auth.uid()) then
    raise exception 'Bu kombini düzenleme yetkin yok.' using errcode = '42501';
  end if;
  delete from public.post_styles where post_id = p_post_id;
  insert into public.post_styles (post_id, style_id)
    select p_post_id, s.id from public.styles s
    where s.slug = any (coalesce(p_style_slugs, '{}')) and s.is_active
    order by s.kind, s.sort_order
    limit 10;
end;
$$;

-- Görseller önce depolamaya yüklenir, ardından kombin kaydı tek işlemde
-- oluşturulur. Görsel yolları kullanıcının kendi klasöründe olmalıdır.
create function public.create_post(
  p_post_id uuid,
  p_title text,
  p_caption text,
  p_visibility public.post_visibility,
  p_comments_enabled boolean,
  p_outfit_details jsonb,
  p_style_slugs text[],
  p_images jsonb,
  p_item_ids uuid[] default '{}'
)
returns public.posts
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  result public.posts;
  img jsonb;
  idx int := 0;
  prefix text := auth.uid()::text || '/' || p_post_id::text || '/';
begin
  if uid is null then
    raise exception 'Oturum bulunamadı.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles where id = uid and account_status = 'active') then
    raise exception 'Hesabın şu anda paylaşım yapamaz.' using errcode = '42501';
  end if;
  if jsonb_typeof(p_images) <> 'array' or jsonb_array_length(p_images) not between 1 and 5 then
    raise exception 'Bir paylaşım 1 ile 5 arasında fotoğraf içermelidir.' using errcode = '22023';
  end if;
  if (select count(*) from public.posts
      where user_id = uid and created_at > now() - interval '1 hour') >= 30 then
    raise exception 'Kısa sürede çok fazla paylaşım yaptın.' using errcode = 'P0429';
  end if;

  insert into public.posts (id, user_id, title, caption, visibility, comments_enabled, outfit_details)
  values (
    p_post_id, uid, btrim(coalesce(p_title, '')), btrim(coalesce(p_caption, '')), p_visibility,
    coalesce(p_comments_enabled, true), coalesce(p_outfit_details, '{}'::jsonb)
  )
  returning * into result;

  for img in select * from jsonb_array_elements(p_images) loop
    if left(img ->> 'storage_path', length(prefix)) <> prefix
       or left(img ->> 'thumb_path', length(prefix)) <> prefix then
      raise exception 'Geçersiz görsel yolu.' using errcode = '42501';
    end if;
    insert into public.post_images (post_id, storage_path, thumb_path, position, width, height)
    values (
      p_post_id, img ->> 'storage_path', img ->> 'thumb_path', idx,
      (img ->> 'width')::int, (img ->> 'height')::int
    );
    idx := idx + 1;
  end loop;

  perform public.set_post_styles(p_post_id, p_style_slugs);
  perform public.attach_post_items(p_post_id, p_item_ids);

  return result;
end;
$$;

-- Fotoğraf sırasını değiştirir; ilk fotoğraf kapak olur.
create function public.reorder_post_images(p_post_id uuid, p_image_ids uuid[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.posts where id = p_post_id and user_id = auth.uid()) then
    raise exception 'Bu kombini düzenleme yetkin yok.' using errcode = '42501';
  end if;
  if (select array_agg(id order by id) from public.post_images where post_id = p_post_id)
     is distinct from (select array_agg(i order by i) from unnest(p_image_ids) as i) then
    raise exception 'Fotoğraf listesi kombinle eşleşmiyor.' using errcode = '22023';
  end if;
  -- Benzersiz sıra kısıtına takılmamak için önce geçici değerlere taşınır.
  update public.post_images set position = position + 10 where post_id = p_post_id;
  update public.post_images p set position = (o.ord - 1)::smallint
  from unnest(p_image_ids) with ordinality as o(id, ord)
  where p.id = o.id and p.post_id = p_post_id;
end;
$$;

alter table public.post_images drop constraint post_images_position_check;
alter table public.post_images add constraint post_images_position_check check (position between 0 and 14);

-- Kombindeki parçaların herkese gösterilebilecek özeti.
create function public.post_item_details(p_post_id uuid)
returns table (
  id uuid, name text, category public.wardrobe_category, color text, brand text,
  photo_path text, thumb_path text, item_position smallint
)
language sql stable security definer set search_path = ''
as $$
  select w.id, w.name, w.category, w.color, w.brand, w.photo_path, w.thumb_path, pi.position
  from public.post_items pi
  join public.wardrobe_items w on w.id = pi.item_id
  where pi.post_id = p_post_id and public.can_view_post(p_post_id)
  order by pi.position;
$$;

-- ---------------------------------------------------------------------------
-- Keşfet
-- ---------------------------------------------------------------------------
-- Modlar:
--   for_you  Kişisel sıralama (varsayılan)
--   popular  Etkileşim / yaş
--   new      En yeni
--   network  Takip ettiklerinin takip ettiği hesaplar
--
-- for_you puanı (şartname §10.2, başlangıç ağırlıkları):
--   stil uyumu          0-30  seçilen stil etiketleriyle örtüşme
--   ilgi benzerliği     0-25  beğenilen/kaydedilen kombinlerin etiketleriyle örtüşme
--   takip               0-20  takip edilen hesaptan gelme
--   güncellik           0-15  72 saatlik yarı ömre yakın üstel azalma
--   çeşitlilik          0-10  yazarın sayfadaki ilk kombini ve yeni üreticilere pay
-- Aynı yazardan bir sayfada en fazla 2 kombin gösterilir.

create or replace function public.explore_feed(
  p_style text default null,
  p_mode text default 'for_you',
  p_only_unfollowed boolean default false,
  p_offset int default 0,
  p_limit int default 24
)
returns setof public.posts
language sql stable security invoker set search_path = ''
as $$
  with my_tags as (
    select style_id from public.user_styles where user_id = auth.uid()
  ),
  interest_tags as (
    select distinct ps.style_id
    from public.post_styles ps
    where ps.post_id in (
      select post_id from public.likes where user_id = auth.uid() and created_at > now() - interval '90 days'
      union
      select post_id from public.saved_posts where user_id = auth.uid() and created_at > now() - interval '90 days'
    )
  ),
  following as (
    select following_id from public.follows where follower_id = auth.uid()
  ),
  network as (
    select distinct f2.following_id as user_id
    from public.follows f1
    join public.follows f2 on f2.follower_id = f1.following_id and f2.status = 'accepted'
    where f1.follower_id = auth.uid() and f1.status = 'accepted'
  ),
  candidates as (
    select p as post, p.user_id, p.id,
      pr.post_count as author_posts,
      extract(epoch from (now() - p.created_at)) / 3600 as age_hours,
      (select count(*) from public.post_styles ps where ps.post_id = p.id
        and ps.style_id in (select style_id from my_tags)) as style_hits,
      (select count(*) from public.post_styles ps where ps.post_id = p.id
        and ps.style_id in (select style_id from interest_tags)) as interest_hits,
      p.user_id in (select following_id from following) as is_followed
    from public.posts p
    join public.profiles pr on pr.id = p.user_id
    where p.visibility = 'public'
      and p.moderation_status = 'active'
      and not pr.is_private
      and pr.account_status = 'active'
      and p.user_id <> auth.uid()
      and p.created_at > now() - interval '90 days'
      and not exists (select 1 from public.hidden_posts h where h.user_id = auth.uid() and h.post_id = p.id)
      and (p_style is null or exists (
        select 1 from public.post_styles ps join public.styles s on s.id = ps.style_id
        where ps.post_id = p.id and s.slug = p_style
      ))
      and (not p_only_unfollowed or p.user_id not in (select following_id from following))
      and (p_mode <> 'network' or (
        p.user_id in (select user_id from network) and p.user_id not in (select following_id from following)
      ))
  ),
  scored as (
    select c.*,
      case p_mode
        when 'new' then extract(epoch from (c.post).created_at)
        when 'popular' then
          ((c.post).like_count + 2 * (c.post).comment_count + 3 * (c.post).save_count + 1)::float8
            / power(c.age_hours + 2, 1.5)
        else
          30.0 * least(c.style_hits, 2) / 2
          + 25.0 * least(c.interest_hits, 3) / 3
          + case when c.is_followed then 20 else 0 end
          + 15.0 * exp(-c.age_hours / 72)
          + least(ln(1 + (c.post).like_count + 2 * (c.post).comment_count + 3 * (c.post).save_count), 5)
      end as base_score
    from candidates c
  ),
  ranked as (
    select s.*, row_number() over (partition by s.user_id order by s.base_score desc) as author_rank
    from scored s
  )
  select (r.post).*
  from ranked r
  where r.author_rank <= 2
  order by
    r.base_score
      + case when p_mode in ('new', 'popular') then 0 else
          case r.author_rank when 1 then 6 else 2 end
          + case when r.author_posts <= 3 then 4 else 0 end
        end
      -- Günlük değişen sabit tohum: sayfalar arasında tutarlı, günden güne farklı.
      + (abs(hashtext(r.id::text || current_date::text)) % 1000) / 1000000.0 desc,
    r.id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.featured_posts(p_limit int default 10)
returns setof public.posts
language sql stable security invoker set search_path = ''
as $$
  select p.* from public.posts p
  where p.featured_at is not null and p.moderation_status = 'active' and p.visibility = 'public'
  order by p.featured_at desc
  limit least(greatest(p_limit, 1), 30);
$$;

create function public.similar_posts(p_post_id uuid, p_limit int default 12)
returns setof public.posts
language sql stable security invoker set search_path = ''
as $$
  with target as (
    select style_id from public.post_styles where post_id = p_post_id
  )
  select p.* from public.posts p
  join public.profiles pr on pr.id = p.user_id
  where p.id <> p_post_id
    and p.visibility = 'public'
    and p.moderation_status = 'active'
    and not pr.is_private
    and not exists (select 1 from public.hidden_posts h where h.user_id = auth.uid() and h.post_id = p.id)
    and exists (select 1 from public.post_styles ps where ps.post_id = p.id and ps.style_id in (select style_id from target))
  order by
    (select count(*) from public.post_styles ps where ps.post_id = p.id and ps.style_id in (select style_id from target)) desc,
    p.created_at desc
  limit least(greatest(p_limit, 1), 30);
$$;

-- Önerilen kişiler: önce takip ettiklerinin takip ettiği hesaplar, sonra
-- stil benzerliği.
create or replace function public.suggested_profiles(p_limit int default 10)
returns setof public.profiles
language sql stable security invoker set search_path = ''
as $$
  select pr.* from public.profiles pr
  where pr.id <> auth.uid()
    and pr.account_status = 'active'
    and not exists (
      select 1 from public.follows f where f.follower_id = auth.uid() and f.following_id = pr.id
    )
  order by
    (select count(*) from public.follows f1
      join public.follows f2 on f2.follower_id = f1.following_id
      where f1.follower_id = auth.uid() and f1.status = 'accepted'
        and f2.following_id = pr.id and f2.status = 'accepted') desc,
    (select count(*) from public.user_styles us
      where us.user_id = pr.id
        and us.style_id in (select style_id from public.user_styles where user_id = auth.uid())) desc,
    pr.post_count desc,
    pr.created_at desc
  limit least(greatest(p_limit, 1), 30);
$$;

-- Kullanıcı adları yalnızca İngilizce harf içerdiği için aramada Türkçe
-- karakterler karşılıklarına çevrilir: "çağrı" aramasında "cagri" bulunur.
create function public.ascii_fold(input text)
returns text
language sql immutable set search_path = ''
as $$
  select translate(lower(input), 'çğıöşüâîûİ', 'cgiosuaiui');
$$;

create or replace function public.search_profiles(p_query text, p_limit int default 20)
returns setof public.profiles
language sql stable security invoker set search_path = ''
as $$
  with q as (
    select public.ascii_fold(ltrim(btrim(p_query), '@')) as handle, lower(btrim(p_query)) as text
  )
  select pr.* from public.profiles pr, q
  where char_length(q.handle) >= 1
    and (
      pr.username like q.handle || '%'
      or pr.username operator(extensions.%) q.handle
      or lower(pr.display_name) like '%' || q.text || '%'
    )
  order by
    (pr.username = q.handle) desc,
    extensions.similarity(pr.username, q.handle) desc,
    pr.follower_count desc
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.search_posts(p_query text, p_limit int default 30)
returns setof public.posts
language sql stable security invoker set search_path = ''
as $$
  select p.* from public.posts p
  where char_length(btrim(p_query)) >= 2
    and p.moderation_status = 'active'
    and (lower(p.title) like '%' || lower(btrim(p_query)) || '%'
      or lower(p.caption) like '%' || lower(btrim(p_query)) || '%')
  order by (lower(p.title) like '%' || lower(btrim(p_query)) || '%') desc, p.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.search_collections(p_query text, p_limit int default 20)
returns setof public.collections
language sql stable security invoker set search_path = ''
as $$
  select c.* from public.collections c
  where char_length(btrim(p_query)) >= 2
    and c.visibility = 'public'
    and c.post_count > 0
    and lower(c.name) like '%' || lower(btrim(p_query)) || '%'
  order by c.post_count desc, c.updated_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- Moderasyon ve yönetim
-- ---------------------------------------------------------------------------

create or replace function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  as_staff boolean := false;
  target public.comments;
begin
  select * into target from public.comments where id = p_comment_id and deleted_at is null;
  if not found then
    raise exception 'Bu yorumu silme yetkin yok.' using errcode = '42501';
  end if;
  if target.user_id <> auth.uid()
     and not exists (select 1 from public.posts p where p.id = target.post_id and p.user_id = auth.uid()) then
    if public.staff_level() >= 2 then
      as_staff := true;
    else
      raise exception 'Bu yorumu silme yetkin yok.' using errcode = '42501';
    end if;
  end if;

  update public.comments set deleted_at = now(), body = '[silindi]' where id = p_comment_id;
  if as_staff then
    insert into public.moderation_actions (actor_id, action, target_user_id, target_comment_id)
    values (auth.uid(), 'comment_removed', target.user_id, p_comment_id);
  end if;
end;
$$;

create or replace function public.admin_set_post_status(
  p_post_id uuid, p_status public.moderation_status, p_note text default null, p_report_id uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  owner uuid;
begin
  perform public.require_staff_level(2);
  update public.posts set moderation_status = p_status where id = p_post_id returning user_id into owner;
  if owner is null then
    raise exception 'Kombin bulunamadı.' using errcode = 'P0002';
  end if;
  insert into public.moderation_actions (actor_id, action, target_user_id, target_post_id, report_id, note)
  values (auth.uid(), 'post_' || p_status::text, owner, p_post_id, p_report_id, p_note);
  if p_status = 'removed' then
    insert into public.notifications (recipient_id, type, post_id, body)
    values (owner, 'system', p_post_id, 'Bir kombinin topluluk kurallarına aykırı bulunduğu için kaldırıldı.');
  end if;
end;
$$;

create or replace function public.admin_set_account_status(
  p_user_id uuid, p_status public.account_status, p_note text default null, p_report_id uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_staff_level(case when p_status = 'banned' then 3 else 2 end);
  if p_user_id = auth.uid() then
    raise exception 'Kendi hesabının durumunu değiştiremezsin.' using errcode = '42501';
  end if;
  if exists (select 1 from public.staff where user_id = p_user_id) and public.staff_level() < 4 then
    raise exception 'Personel hesapları yalnızca sistem sahibi tarafından kısıtlanabilir.' using errcode = '42501';
  end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  if not found then
    raise exception 'Kullanıcı bulunamadı.' using errcode = 'P0002';
  end if;
  insert into public.moderation_actions (actor_id, action, target_user_id, report_id, note)
  values (auth.uid(), 'account_' || p_status::text, p_user_id, p_report_id, p_note);
end;
$$;

create or replace function public.admin_resolve_report(
  p_report_id uuid, p_status public.report_status, p_note text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_staff_level(2);
  update public.reports
  set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_report_id;
  if not found then
    raise exception 'Şikâyet bulunamadı.' using errcode = 'P0002';
  end if;
  insert into public.moderation_actions (actor_id, action, report_id, note)
  values (auth.uid(), 'report_' || p_status::text, p_report_id, p_note);
end;
$$;

create function public.admin_warn_user(p_user_id uuid, p_message text, p_report_id uuid default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_staff_level(2);
  if char_length(btrim(coalesce(p_message, ''))) not between 1 and 500 then
    raise exception 'Uyarı metni 1-500 karakter olmalı.' using errcode = '22023';
  end if;
  insert into public.notifications (recipient_id, type, body) values (p_user_id, 'system', btrim(p_message));
  insert into public.moderation_actions (actor_id, action, target_user_id, report_id, note)
  values (auth.uid(), 'user_warned', p_user_id, p_report_id, btrim(p_message));
end;
$$;

create function public.admin_set_post_flags(p_post_id uuid, p_featured boolean, p_sample boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_staff_level(3);
  update public.posts
  set featured_at = case when p_featured then coalesce(featured_at, now()) else null end,
      is_sample = p_sample
  where id = p_post_id;
  if not found then
    raise exception 'Kombin bulunamadı.' using errcode = 'P0002';
  end if;
  insert into public.moderation_actions (actor_id, action, target_post_id, note)
  values (auth.uid(), 'post_flags', p_post_id,
    format('featured=%s sample=%s', p_featured, p_sample));
end;
$$;

create function public.admin_upsert_style(
  p_slug text, p_name text, p_kind text, p_is_active boolean, p_sort_order smallint default 0
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_staff_level(3);
  insert into public.styles (slug, name, kind, is_active, sort_order)
  values (lower(btrim(p_slug)), btrim(p_name), p_kind, p_is_active, p_sort_order)
  on conflict (slug) do update
    set name = excluded.name, kind = excluded.kind, is_active = excluded.is_active, sort_order = excluded.sort_order;
  insert into public.moderation_actions (actor_id, action, note)
  values (auth.uid(), 'style_upsert', p_slug);
end;
$$;

create function public.admin_set_setting(p_key text, p_value jsonb)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_staff_level(3);
  insert into public.app_settings (key, value, updated_at, updated_by)
  values (p_key, p_value, now(), auth.uid())
  on conflict (key) do update set value = excluded.value, updated_at = now(), updated_by = auth.uid();
  insert into public.moderation_actions (actor_id, action, note)
  values (auth.uid(), 'setting_' || p_key, p_value::text);
end;
$$;

create function public.admin_set_staff_role(p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform public.require_staff_level(4);
  if p_user_id = auth.uid() then
    raise exception 'Kendi rolünü değiştiremezsin.' using errcode = '42501';
  end if;
  if p_role is null then
    delete from public.staff where user_id = p_user_id;
  else
    insert into public.staff (user_id, role) values (p_user_id, p_role::public.staff_role)
    on conflict (user_id) do update set role = excluded.role;
  end if;
  insert into public.moderation_actions (actor_id, action, target_user_id, note)
  values (auth.uid(), 'staff_role', p_user_id, coalesce(p_role, 'removed'));
end;
$$;

-- Destek ekibi kullanıcıları e-posta adresiyle de bulabilir.
create function public.admin_search_users(
  p_query text default '', p_status public.account_status default null, p_limit int default 30, p_offset int default 0
)
returns table (
  id uuid, username text, display_name text, email text, account_status public.account_status,
  is_private boolean, post_count integer, follower_count integer, created_at timestamptz,
  report_count bigint, staff_role text
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_staff_level(1);
  return query
    select p.id, p.username, p.display_name, u.email::text, p.account_status, p.is_private,
      p.post_count, p.follower_count, p.created_at,
      (select count(*) from public.reports r where r.reported_user_id = p.id),
      (select s.role::text from public.staff s where s.user_id = p.id)
    from public.profiles p
    join auth.users u on u.id = p.id
    where (p_status is null or p.account_status = p_status)
      and (
        coalesce(btrim(p_query), '') = ''
        or p.username like public.ascii_fold(ltrim(btrim(p_query), '@')) || '%'
        or lower(p.display_name) like '%' || lower(btrim(p_query)) || '%'
        or lower(u.email::text) = lower(btrim(p_query))
        or p.id::text = btrim(p_query)
      )
    order by p.created_at desc
    limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
end;
$$;

create function public.admin_overview()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
begin
  perform public.require_staff_level(1);
  return jsonb_build_object(
    'users_total', (select count(*) from public.profiles),
    'users_new_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'users_active_7d', (
      select count(distinct uid) from (
        select user_id as uid from public.posts where created_at > now() - interval '7 days'
        union select user_id from public.likes where created_at > now() - interval '7 days'
        union select user_id from public.comments where created_at > now() - interval '7 days'
        union select follower_id from public.follows where created_at > now() - interval '7 days'
      ) a
    ),
    'posts_total', (select count(*) from public.posts),
    'posts_7d', (select count(*) from public.posts where created_at > now() - interval '7 days'),
    'reports_open', (select count(*) from public.reports where status in ('open', 'in_review')),
    'posts_removed', (select count(*) from public.posts where moderation_status = 'removed'),
    'accounts_restricted', (select count(*) from public.profiles where account_status <> 'active')
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Yetkiler
-- ---------------------------------------------------------------------------

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated;
revoke execute on function public.touch_updated_at() from authenticated;
revoke execute on function public.on_profile_privacy_change() from authenticated;
revoke execute on function public.on_post_count_change() from authenticated;
revoke execute on function public.on_like_change() from authenticated;
revoke execute on function public.on_save_change() from authenticated;
revoke execute on function public.guard_comment_insert() from authenticated;
revoke execute on function public.on_comment_change() from authenticated;
revoke execute on function public.on_follow_change() from authenticated;
revoke execute on function public.on_post_created_notify() from authenticated;
revoke execute on function public.guard_username_change() from authenticated;
revoke execute on function public.guard_pins() from authenticated;
revoke execute on function public.guard_wardrobe_item() from authenticated;
revoke execute on function public.on_post_item_change() from authenticated;
revoke execute on function public.guard_collection_insert() from authenticated;
revoke execute on function public.on_collection_post_change() from authenticated;
revoke execute on function public.guard_report_insert() from authenticated;

-- ---------------------------------------------------------------------------
-- Depolama: gardırop fotoğrafları
-- ---------------------------------------------------------------------------
-- Yol biçimi: {user_id}/{item_id}.jpg ve {user_id}/{item_id}_t.jpg

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('wardrobe', 'wardrobe', false, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

create policy "wardrobe: sahibi veya bağlı kombin görünürse" on storage.objects
  for select to authenticated using (
    bucket_id = 'wardrobe' and public.can_read_wardrobe_object(name)
  );
create policy "wardrobe: sahibi yükler" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "wardrobe: sahibi siler" on storage.objects
  for delete to authenticated using (
    bucket_id = 'wardrobe' and (storage.foldername(name))[1] = auth.uid()::text
  );
