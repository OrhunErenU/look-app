-- LOOK ilk veritabanı şeması
-- Kapsam: profiller, kombinler, görseller, stiller, takip, beğeni, yorum,
-- kaydetme, bildirim, engelleme, şikâyet, moderasyon ve depolama politikaları.
--
-- Yetkilendirme ilkesi: her tabloda RLS açıktır. İstemcinin doğrudan
-- yazamaması gereken alanlar (sayaçlar, durumlar) sütun yetkileriyle
-- kapatılmıştır; birden fazla tabloyu etkileyen işlemler SECURITY DEFINER
-- fonksiyonlarla atomik olarak yapılır.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Tipler
-- ---------------------------------------------------------------------------

create type public.post_visibility as enum ('public', 'followers', 'private');
create type public.follow_status as enum ('pending', 'accepted');
create type public.account_status as enum ('active', 'restricted', 'suspended', 'banned');
create type public.moderation_status as enum ('active', 'under_review', 'removed');
create type public.notification_type as enum (
  'follow', 'follow_request', 'follow_accepted', 'like', 'comment', 'reply', 'new_post', 'system'
);
create type public.report_reason as enum (
  'harassment', 'hate_speech', 'spam', 'fake_account', 'unauthorized_photo',
  'sexual_content', 'copyright', 'other'
);
create type public.report_status as enum ('open', 'in_review', 'actioned', 'dismissed');
create type public.staff_role as enum ('moderator', 'admin');

-- ---------------------------------------------------------------------------
-- Profiller
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Kullanıcı adı her zaman küçük harfle saklanır; böylece "OrhunLook" ve
  -- "orhunlook" aynı kullanıcı adı sayılır.
  username text not null unique
    constraint username_format check (username ~ '^[a-z0-9._]{3,30}$'
      and username !~ '^[.]' and username !~ '[.]$' and username !~ '[.][.]'),
  display_name text constraint display_name_length check (char_length(display_name) <= 50),
  bio text constraint bio_length check (char_length(bio) <= 160),
  avatar_path text,
  is_private boolean not null default false,
  account_status public.account_status not null default 'active',
  follower_count integer not null default 0 check (follower_count >= 0),
  following_count integer not null default 0 check (following_count >= 0),
  post_count integer not null default 0 check (post_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_username_trgm on public.profiles using gin (username extensions.gin_trgm_ops);
create index profiles_display_name_trgm on public.profiles using gin (lower(display_name) extensions.gin_trgm_ops);

-- Doğum tarihi gibi herkese görünmemesi gereken hesap bilgileri ayrı tabloda
-- tutulur; RLS satır bazlı çalıştığı için profiles tablosuna konmamıştır.
create table public.account_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  birth_date date not null,
  terms_accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table public.notification_settings (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  likes boolean not null default true,
  comments boolean not null default true,
  follows boolean not null default true,
  new_posts boolean not null default false,
  email boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.staff (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  role public.staff_role not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Stiller
-- ---------------------------------------------------------------------------

create table public.styles (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]{2,40}$'),
  name text not null,
  is_active boolean not null default true,
  sort_order smallint not null default 0
);

insert into public.styles (slug, name, sort_order) values
  ('streetwear', 'Streetwear', 1),
  ('minimal', 'Minimal', 2),
  ('smart-casual', 'Smart casual', 3),
  ('old-money', 'Old money', 4),
  ('vintage', 'Vintage', 5),
  ('casual', 'Casual', 6),
  ('sporty', 'Sporty', 7),
  ('formal', 'Formal', 8),
  ('alternative', 'Alternative', 9),
  ('y2k', 'Y2K', 10),
  ('exploring', 'Kendi stilimi keşfediyorum', 11);

create table public.user_styles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  style_id smallint not null references public.styles (id) on delete cascade,
  primary key (user_id, style_id)
);

-- ---------------------------------------------------------------------------
-- Kombinler
-- ---------------------------------------------------------------------------

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  caption text not null default '' constraint caption_length check (char_length(caption) <= 2200),
  visibility public.post_visibility not null default 'public',
  comments_enabled boolean not null default true,
  -- İsteğe bağlı kıyafet detayları: {"top": "...", "bottom": "...", ...}
  outfit_details jsonb not null default '{}'::jsonb
    constraint outfit_details_object check (jsonb_typeof(outfit_details) = 'object'),
  moderation_status public.moderation_status not null default 'active',
  like_count integer not null default 0 check (like_count >= 0),
  comment_count integer not null default 0 check (comment_count >= 0),
  save_count integer not null default 0 check (save_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index posts_user_created on public.posts (user_id, created_at desc);
create index posts_created on public.posts (created_at desc) where moderation_status = 'active';

create table public.post_images (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,
  thumb_path text not null,
  position smallint not null check (position between 0 and 4),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  created_at timestamptz not null default now(),
  unique (post_id, position)
);

create table public.post_styles (
  post_id uuid not null references public.posts (id) on delete cascade,
  style_id smallint not null references public.styles (id) on delete cascade,
  primary key (post_id, style_id)
);

create index post_styles_style on public.post_styles (style_id, post_id);

-- ---------------------------------------------------------------------------
-- Sosyal ilişkiler
-- ---------------------------------------------------------------------------

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  status public.follow_status not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create index follows_following on public.follows (following_id, status);

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create index blocks_blocked on public.blocks (blocked_id);

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index likes_post on public.likes (post_id);

create table public.saved_posts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.hidden_posts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  parent_id uuid references public.comments (id) on delete cascade,
  body text not null constraint body_length check (char_length(btrim(body)) between 1 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Silinen yorum, yanıtları kaybolmasın diye "silindi" olarak işaretlenir.
  deleted_at timestamptz
);

create index comments_post_created on public.comments (post_id, created_at);
create index comments_user_created on public.comments (user_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  post_id uuid references public.posts (id) on delete cascade,
  comment_id uuid references public.comments (id) on delete cascade,
  body text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_recipient on public.notifications (recipient_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Moderasyon
-- ---------------------------------------------------------------------------

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles (id) on delete set null,
  reported_user_id uuid references public.profiles (id) on delete set null,
  post_id uuid references public.posts (id) on delete set null,
  comment_id uuid references public.comments (id) on delete set null,
  reason public.report_reason not null,
  details text check (char_length(details) <= 1000),
  status public.report_status not null default 'open',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint report_has_target check (
    reported_user_id is not null or post_id is not null or comment_id is not null
  )
);

create index reports_status on public.reports (status, created_at);

create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  target_user_id uuid references public.profiles (id) on delete set null,
  target_post_id uuid references public.posts (id) on delete set null,
  target_comment_id uuid references public.comments (id) on delete set null,
  report_id uuid references public.reports (id) on delete set null,
  note text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Yardımcı fonksiyonlar (RLS içinde kullanılır)
-- ---------------------------------------------------------------------------

create function public.is_staff()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.staff where user_id = auth.uid());
$$;

-- Yardımcı fonksiyonlar RLS içinde kullanıldığı için istemciden de
-- çağrılabilir. Üçüncü kişiler arasındaki ilişkileri sızdırmamaları için
-- yalnızca çağıranı ilgilendiren sorulara yanıt verirler.
create function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select auth.uid() in (a, b) and exists (
    select 1 from public.blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;

create function public.is_approved_follower(follower uuid, target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select follower = auth.uid() and exists (
    select 1 from public.follows
    where follower_id = follower and following_id = target and status = 'accepted'
  );
$$;

-- Bir kullanıcının profili görüntülenebilir mi? (Gizli profiller de
-- aramada görünür; yalnızca içerikleri korunur.)
create function public.can_see_profile(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select target = auth.uid()
    or public.is_staff()
    or (
      auth.uid() is not null
      and not public.is_blocked_between(auth.uid(), target)
      and exists (
        select 1 from public.profiles
        where id = target and account_status in ('active', 'restricted')
      )
    );
$$;

-- Bir kullanıcının içerikleri (takip listesi, gönderi ızgarası vb.) açık mı?
create function public.can_see_content_of(target uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select target = auth.uid()
    or public.is_staff()
    or (
      public.can_see_profile(target)
      and (
        not (select is_private from public.profiles where id = target)
        or public.is_approved_follower(auth.uid(), target)
      )
    );
$$;

-- Gönderi satırı üzerinden görünürlük kontrolü. posts politikası satırın
-- kendi sütunlarını verdiği için tabloyu yeniden sorgulamaz.
create function public.can_view_post_row(
  owner uuid, vis public.post_visibility, mod_status public.moderation_status
)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select case
    when owner = auth.uid() then true
    when public.is_staff() then true
    when mod_status = 'removed' then false
    when vis = 'private' then false
    when not public.can_see_profile(owner) then false
    when vis = 'followers' then public.is_approved_follower(auth.uid(), owner)
    else not (select is_private from public.profiles where id = owner)
      or public.is_approved_follower(auth.uid(), owner)
  end;
$$;

create function public.can_view_post(target_post uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((
    select public.can_view_post_row(p.user_id, p.visibility, p.moderation_status)
    from public.posts p where p.id = target_post
  ), false);
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.account_private enable row level security;
alter table public.notification_settings enable row level security;
alter table public.staff enable row level security;
alter table public.styles enable row level security;
alter table public.user_styles enable row level security;
alter table public.posts enable row level security;
alter table public.post_images enable row level security;
alter table public.post_styles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.likes enable row level security;
alter table public.saved_posts enable row level security;
alter table public.hidden_posts enable row level security;
alter table public.comments enable row level security;
alter table public.notifications enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;

-- Varsayılan olarak hiçbir şey yazılamaz; yalnızca aşağıda açıkça verilen
-- sütun yetkileri geçerlidir.
revoke all on all tables in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant select on public.styles to anon;

-- profiles
create policy "profiles: görünür profiller" on public.profiles
  for select to authenticated using (public.can_see_profile(id));
create policy "profiles: kendi profilini güncelle" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
grant update (username, display_name, bio, avatar_path, is_private) on public.profiles to authenticated;

-- account_private
create policy "account_private: yalnızca sahibi" on public.account_private
  for select to authenticated using (user_id = auth.uid());

-- notification_settings
create policy "notification_settings: sahibi okur" on public.notification_settings
  for select to authenticated using (user_id = auth.uid());
create policy "notification_settings: sahibi günceller" on public.notification_settings
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
grant update (likes, comments, follows, new_posts, email) on public.notification_settings to authenticated;

-- staff
create policy "staff: personel görür" on public.staff
  for select to authenticated using (user_id = auth.uid() or public.is_staff());

-- styles
create policy "styles: herkes okur" on public.styles
  for select to anon, authenticated using (true);

-- user_styles
create policy "user_styles: profil görünürse" on public.user_styles
  for select to authenticated using (public.can_see_profile(user_id));
create policy "user_styles: sahibi ekler" on public.user_styles
  for insert to authenticated with check (user_id = auth.uid());
create policy "user_styles: sahibi siler" on public.user_styles
  for delete to authenticated using (user_id = auth.uid());
grant insert, delete on public.user_styles to authenticated;

-- posts (oluşturma create_post fonksiyonu ile yapılır)
create policy "posts: görünür gönderiler" on public.posts
  for select to authenticated using (public.can_view_post_row(user_id, visibility, moderation_status));
create policy "posts: sahibi günceller" on public.posts
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "posts: sahibi siler" on public.posts
  for delete to authenticated using (user_id = auth.uid());
grant update (caption, visibility, comments_enabled, outfit_details) on public.posts to authenticated;
grant delete on public.posts to authenticated;

-- post_images / post_styles
create policy "post_images: gönderi görünürse" on public.post_images
  for select to authenticated using (public.can_view_post(post_id));
create policy "post_styles: gönderi görünürse" on public.post_styles
  for select to authenticated using (public.can_view_post(post_id));

-- follows (oluşturma ve kabul fonksiyonlarla yapılır)
create policy "follows: taraflar veya içerik görünürse" on public.follows
  for select to authenticated using (
    follower_id = auth.uid() or following_id = auth.uid()
    or (
      status = 'accepted'
      and public.can_see_content_of(following_id)
      and public.can_see_profile(follower_id)
    )
  );
create policy "follows: taraflar siler" on public.follows
  for delete to authenticated using (follower_id = auth.uid() or following_id = auth.uid());
grant delete on public.follows to authenticated;

-- blocks (oluşturma block_user fonksiyonu ile yapılır)
create policy "blocks: engelleyen görür" on public.blocks
  for select to authenticated using (blocker_id = auth.uid());
create policy "blocks: engelleyen kaldırır" on public.blocks
  for delete to authenticated using (blocker_id = auth.uid());
grant delete on public.blocks to authenticated;

-- likes
create policy "likes: gönderi görünürse" on public.likes
  for select to authenticated using (
    public.can_view_post(post_id) and public.can_see_profile(user_id)
  );
create policy "likes: kendi beğenisi" on public.likes
  for insert to authenticated with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy "likes: kendi beğenisini kaldırır" on public.likes
  for delete to authenticated using (user_id = auth.uid());
grant insert (user_id, post_id), delete on public.likes to authenticated;

-- saved_posts: kaydedilenler yalnızca sahibine görünür
create policy "saved_posts: yalnızca sahibi" on public.saved_posts
  for select to authenticated using (user_id = auth.uid());
create policy "saved_posts: sahibi kaydeder" on public.saved_posts
  for insert to authenticated with check (user_id = auth.uid() and public.can_view_post(post_id));
create policy "saved_posts: sahibi kaldırır" on public.saved_posts
  for delete to authenticated using (user_id = auth.uid());
grant insert (user_id, post_id), delete on public.saved_posts to authenticated;

-- hidden_posts
create policy "hidden_posts: yalnızca sahibi" on public.hidden_posts
  for select to authenticated using (user_id = auth.uid());
create policy "hidden_posts: sahibi gizler" on public.hidden_posts
  for insert to authenticated with check (user_id = auth.uid());
create policy "hidden_posts: sahibi geri alır" on public.hidden_posts
  for delete to authenticated using (user_id = auth.uid());
grant insert (user_id, post_id), delete on public.hidden_posts to authenticated;

-- comments
create policy "comments: gönderi görünürse" on public.comments
  for select to authenticated using (
    public.can_view_post(post_id)
    and (user_id = auth.uid() or not public.is_blocked_between(auth.uid(), user_id))
  );
create policy "comments: yorum yaz" on public.comments
  for insert to authenticated with check (
    user_id = auth.uid()
    and deleted_at is null
    and public.can_view_post(post_id)
    and exists (
      select 1 from public.posts p
      where p.id = post_id
        and p.comments_enabled
        and not public.is_blocked_between(auth.uid(), p.user_id)
    )
    and exists (
      select 1 from public.profiles where id = auth.uid() and account_status = 'active'
    )
  );
create policy "comments: kendi yorumunu düzenle" on public.comments
  for update to authenticated using (user_id = auth.uid() and deleted_at is null)
  with check (user_id = auth.uid());
grant insert (post_id, user_id, parent_id, body), update (body) on public.comments to authenticated;

-- notifications (oluşturma tetikleyicilerle yapılır)
create policy "notifications: alıcı görür" on public.notifications
  for select to authenticated using (
    recipient_id = auth.uid()
    and (actor_id is null or not public.is_blocked_between(auth.uid(), actor_id))
  );
create policy "notifications: alıcı okundu yapar" on public.notifications
  for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
create policy "notifications: alıcı siler" on public.notifications
  for delete to authenticated using (recipient_id = auth.uid());
grant update (is_read), delete on public.notifications to authenticated;

-- reports: kullanıcı oluşturur, yalnızca personel okur
create policy "reports: kullanıcı şikâyet eder" on public.reports
  for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
create policy "reports: personel görür" on public.reports
  for select to authenticated using (public.is_staff());
grant insert (reporter_id, reported_user_id, post_id, comment_id, reason, details) on public.reports to authenticated;

-- moderation_actions: yalnızca personel okur, fonksiyonlar yazar
create policy "moderation_actions: personel görür" on public.moderation_actions
  for select to authenticated using (public.is_staff());

-- ---------------------------------------------------------------------------
-- Tetikleyiciler: zaman damgaları, sayaçlar, kötüye kullanım sınırları
-- ---------------------------------------------------------------------------

create function public.touch_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();
create trigger comments_touch before update of body on public.comments
  for each row execute function public.touch_updated_at();

-- Gizli profil herkese açığa geçince bekleyen istekler kabul edilir.
create function public.on_profile_privacy_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if old.is_private and not new.is_private then
    update public.follows set status = 'accepted'
    where following_id = new.id and status = 'pending';
  end if;
  return new;
end;
$$;

create trigger profiles_privacy after update of is_private on public.profiles
  for each row execute function public.on_profile_privacy_change();

create function public.on_post_count_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles set post_count = post_count + 1 where id = new.user_id;
  elsif tg_op = 'DELETE' then
    update public.profiles set post_count = greatest(post_count - 1, 0) where id = old.user_id;
  end if;
  return null;
end;
$$;

create trigger posts_count after insert or delete on public.posts
  for each row execute function public.on_post_count_change();

create function public.on_like_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  post_owner uuid;
  wants boolean;
begin
  if tg_op = 'INSERT' then
    update public.posts set like_count = like_count + 1 where id = new.post_id
      returning user_id into post_owner;
    select coalesce((select likes from public.notification_settings where user_id = post_owner), true)
      into wants;
    if post_owner <> new.user_id and wants then
      insert into public.notifications (recipient_id, actor_id, type, post_id)
      values (post_owner, new.user_id, 'like', new.post_id);
    end if;
    return new;
  else
    update public.posts set like_count = greatest(like_count - 1, 0) where id = old.post_id;
    delete from public.notifications
      where type = 'like' and actor_id = old.user_id and post_id = old.post_id;
    return old;
  end if;
end;
$$;

create trigger likes_change after insert or delete on public.likes
  for each row execute function public.on_like_change();

create function public.on_save_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts set save_count = save_count + 1 where id = new.post_id;
  else
    update public.posts set save_count = greatest(save_count - 1, 0) where id = old.post_id;
  end if;
  return null;
end;
$$;

create trigger saved_change after insert or delete on public.saved_posts
  for each row execute function public.on_save_change();

-- Spam önleme: dakikada en fazla 10 yorum ve 2 dakika içinde aynı metnin
-- tekrar gönderilmesi engellenir.
create function public.guard_comment_insert()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  parent_post uuid;
begin
  new.body = btrim(new.body);

  if new.parent_id is not null then
    select post_id into parent_post from public.comments where id = new.parent_id;
    if parent_post is distinct from new.post_id then
      raise exception 'Yanıt verilen yorum bu gönderiye ait değil.' using errcode = '22023';
    end if;
  end if;

  if (select count(*) from public.comments
      where user_id = new.user_id and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'Çok hızlı yorum yapıyorsun. Biraz sonra tekrar dene.' using errcode = 'P0429';
  end if;

  if exists (select 1 from public.comments
      where user_id = new.user_id and post_id = new.post_id and body = new.body
        and created_at > now() - interval '2 minutes') then
    raise exception 'Aynı yorumu kısa süre önce gönderdin.' using errcode = 'P0409';
  end if;

  return new;
end;
$$;

create trigger comments_guard before insert on public.comments
  for each row execute function public.guard_comment_insert();

create function public.on_comment_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  post_owner uuid;
  parent_author uuid;
  owner_wants boolean;
  parent_wants boolean;
begin
  if tg_op = 'INSERT' then
    update public.posts set comment_count = comment_count + 1 where id = new.post_id
      returning user_id into post_owner;
    select coalesce((select comments from public.notification_settings where user_id = post_owner), true)
      into owner_wants;

    if new.parent_id is not null then
      select user_id into parent_author from public.comments where id = new.parent_id;
      select coalesce((select comments from public.notification_settings where user_id = parent_author), true)
        into parent_wants;
      if parent_author <> new.user_id and parent_wants
         and not public.is_blocked_between(parent_author, new.user_id) then
        insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
        values (parent_author, new.user_id, 'reply', new.post_id, new.id);
      end if;
    end if;

    if post_owner <> new.user_id and owner_wants
       and post_owner is distinct from parent_author then
      insert into public.notifications (recipient_id, actor_id, type, post_id, comment_id)
      values (post_owner, new.user_id, 'comment', new.post_id, new.id);
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    -- Yumuşak silme sayacı düşürür.
    if old.deleted_at is null and new.deleted_at is not null then
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = new.post_id;
      delete from public.notifications where comment_id = new.id;
    end if;
    return new;
  else
    if old.deleted_at is null then
      update public.posts set comment_count = greatest(comment_count - 1, 0) where id = old.post_id;
    end if;
    return old;
  end if;
end;
$$;

create trigger comments_change after insert or update of deleted_at or delete on public.comments
  for each row execute function public.on_comment_change();

create function public.on_follow_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  wants boolean;
begin
  if tg_op = 'INSERT' then
    select coalesce((select follows from public.notification_settings where user_id = new.following_id), true)
      into wants;
    if new.status = 'accepted' then
      update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
      update public.profiles set following_count = following_count + 1 where id = new.follower_id;
      if wants then
        insert into public.notifications (recipient_id, actor_id, type)
        values (new.following_id, new.follower_id, 'follow');
      end if;
    else
      -- Takip istekleri her zaman bildirilir; aksi hâlde onaylanamazlar.
      insert into public.notifications (recipient_id, actor_id, type)
      values (new.following_id, new.follower_id, 'follow_request');
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    if old.status = 'pending' and new.status = 'accepted' then
      update public.profiles set follower_count = follower_count + 1 where id = new.following_id;
      update public.profiles set following_count = following_count + 1 where id = new.follower_id;
      delete from public.notifications
        where type = 'follow_request' and recipient_id = new.following_id and actor_id = new.follower_id;
      insert into public.notifications (recipient_id, actor_id, type)
      values (new.follower_id, new.following_id, 'follow_accepted');
    end if;
    return new;
  else
    if old.status = 'accepted' then
      update public.profiles set follower_count = greatest(follower_count - 1, 0) where id = old.following_id;
      update public.profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    end if;
    delete from public.notifications
      where type in ('follow', 'follow_request')
        and recipient_id = old.following_id and actor_id = old.follower_id;
    return old;
  end if;
end;
$$;

create trigger follows_change after insert or update of status or delete on public.follows
  for each row execute function public.on_follow_change();

create function public.on_post_created_notify()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.visibility <> 'private' then
    insert into public.notifications (recipient_id, actor_id, type, post_id)
    select f.follower_id, new.user_id, 'new_post', new.id
    from public.follows f
    join public.notification_settings s on s.user_id = f.follower_id and s.new_posts
    where f.following_id = new.user_id and f.status = 'accepted';
  end if;
  return null;
end;
$$;

-- create_post görselleri ekledikten sonra bildirim gönderilsin diye
-- ertelenmiş kısıt tetikleyicisi kullanılır.
create constraint trigger posts_notify after insert on public.posts
  deferrable initially deferred
  for each row execute function public.on_post_created_notify();

-- ---------------------------------------------------------------------------
-- İstemci fonksiyonları (RPC)
-- ---------------------------------------------------------------------------

-- Kayıt sonrası profil oluşturma: kullanıcı adı, yaş kontrolü, stil
-- tercihleri ve bildirim ayarları tek işlemde yazılır.
create function public.create_profile(
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
  if p_birth_date > (current_date - interval '18 years')::date then
    raise exception 'LOOK şu an yalnızca 18 yaş ve üzeri kullanıcılara açık.' using errcode = '22023';
  end if;
  if p_birth_date < date '1900-01-01' then
    raise exception 'Geçerli bir doğum tarihi gir.' using errcode = '22023';
  end if;

  insert into public.profiles (id, username, display_name, bio)
  values (uid, lower(btrim(p_username)), nullif(btrim(p_display_name), ''), nullif(btrim(p_bio), ''))
  returning * into result;

  insert into public.account_private (user_id, birth_date) values (uid, p_birth_date);
  insert into public.notification_settings (user_id) values (uid);
  insert into public.user_styles (user_id, style_id)
    select uid, s.id from public.styles s where s.slug = any (p_style_slugs) and s.is_active;

  return result;
end;
$$;

create function public.is_username_available(p_username text)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select not exists (select 1 from public.profiles where username = lower(btrim(p_username)));
$$;

-- Görseller önce depolamaya yüklenir, ardından gönderi kaydı tek işlemde
-- oluşturulur. Görsel yolları kullanıcının kendi klasöründe olmalıdır.
create function public.create_post(
  p_post_id uuid,
  p_caption text,
  p_visibility public.post_visibility,
  p_comments_enabled boolean,
  p_outfit_details jsonb,
  p_style_slugs text[],
  p_images jsonb
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

  insert into public.posts (id, user_id, caption, visibility, comments_enabled, outfit_details)
  values (
    p_post_id, uid, btrim(coalesce(p_caption, '')), p_visibility,
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

  insert into public.post_styles (post_id, style_id)
    select p_post_id, s.id from public.styles s
    where s.slug = any (coalesce(p_style_slugs, '{}')) and s.is_active
    limit 5;

  return result;
end;
$$;

create function public.set_post_styles(p_post_id uuid, p_style_slugs text[])
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not exists (select 1 from public.posts where id = p_post_id and user_id = auth.uid()) then
    raise exception 'Bu gönderiyi düzenleme yetkin yok.' using errcode = '42501';
  end if;
  delete from public.post_styles where post_id = p_post_id;
  insert into public.post_styles (post_id, style_id)
    select p_post_id, s.id from public.styles s
    where s.slug = any (coalesce(p_style_slugs, '{}')) and s.is_active
    limit 5;
end;
$$;

-- Takip: herkese açık hesapta doğrudan kabul, gizli hesapta istek.
create function public.follow_user(p_target uuid)
returns public.follow_status
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
  target_private boolean;
  new_status public.follow_status;
begin
  if uid is null or uid = p_target then
    raise exception 'Bu kullanıcıyı takip edemezsin.' using errcode = '22023';
  end if;
  if public.is_blocked_between(uid, p_target) then
    raise exception 'Bu kullanıcıyı takip edemezsin.' using errcode = '42501';
  end if;
  select is_private into target_private from public.profiles
    where id = p_target and account_status in ('active', 'restricted');
  if not found then
    raise exception 'Kullanıcı bulunamadı.' using errcode = 'P0002';
  end if;
  if (select count(*) from public.follows
      where follower_id = uid and created_at > now() - interval '1 hour') >= 200 then
    raise exception 'Kısa sürede çok fazla takip işlemi yaptın.' using errcode = 'P0429';
  end if;

  new_status := case when target_private then 'pending' else 'accepted' end;
  insert into public.follows (follower_id, following_id, status)
  values (uid, p_target, new_status)
  on conflict (follower_id, following_id) do nothing;

  select status into new_status from public.follows
    where follower_id = uid and following_id = p_target;
  return new_status;
end;
$$;

create function public.respond_follow_request(p_follower uuid, p_accept boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if p_accept then
    update public.follows set status = 'accepted'
    where follower_id = p_follower and following_id = auth.uid() and status = 'pending';
  else
    delete from public.follows
    where follower_id = p_follower and following_id = auth.uid() and status = 'pending';
  end if;
end;
$$;

-- Engelleme: iki yöndeki takip ilişkileri sonlanır.
create function public.block_user(p_target uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or uid = p_target then
    raise exception 'Bu kullanıcıyı engelleyemezsin.' using errcode = '22023';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (uid, p_target)
    on conflict do nothing;
  delete from public.follows
    where (follower_id = uid and following_id = p_target)
       or (follower_id = p_target and following_id = uid);
end;
$$;

-- Engellenen profiller RLS gereği görünmez; ayarlar ekranındaki liste için
-- yalnızca engelleyenin kendi kayıtları özet bilgiyle döndürülür.
create function public.my_blocked_users()
returns table (id uuid, username text, display_name text, avatar_path text)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.username, p.display_name, p.avatar_path
  from public.blocks b join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;

create function public.delete_comment(p_comment_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.comments c set deleted_at = now(), body = '[silindi]'
  where c.id = p_comment_id and c.deleted_at is null
    and (
      c.user_id = auth.uid()
      or exists (select 1 from public.posts p where p.id = c.post_id and p.user_id = auth.uid())
      or public.is_staff()
    );
  if not found then
    raise exception 'Bu yorumu silme yetkin yok.' using errcode = '42501';
  end if;
end;
$$;

-- Ana sayfa: takip edilen kullanıcılar ve kullanıcının kendi paylaşımları,
-- kronolojik sırada. SECURITY INVOKER olduğu için RLS geçerlidir.
create function public.home_feed(p_before timestamptz default null, p_limit int default 20)
returns setof public.posts
language sql stable security invoker set search_path = ''
as $$
  select p.* from public.posts p
  where (
      p.user_id = auth.uid()
      or p.user_id in (
        select following_id from public.follows
        where follower_id = auth.uid() and status = 'accepted'
      )
    )
    and p.moderation_status <> 'removed'
    and (p_before is null or p.created_at < p_before)
  order by p.created_at desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- Keşfet: basit ve açıklanabilir sıralama.
--   puan = etkileşim / (yaş + 2)^1.5 + stil uyumu + küçük rastgelelik
-- Aynı kullanıcıdan bir sayfada en fazla 2 gönderi gösterilir.
create function public.explore_feed(
  p_style text default null,
  p_mode text default 'popular',
  p_only_unfollowed boolean default false,
  p_offset int default 0,
  p_limit int default 24
)
returns setof public.posts
language sql stable security invoker set search_path = ''
as $$
  with my_styles as (
    select style_id from public.user_styles where user_id = auth.uid()
  ),
  candidates as (
    select p.*,
      case when p_mode = 'new' then extract(epoch from p.created_at)
      else
        (p.like_count + 2 * p.comment_count + 3 * p.save_count + 1)::float8
          / power(extract(epoch from (now() - p.created_at)) / 3600 + 2, 1.5)
        + case when exists (
            select 1 from public.post_styles ps
            where ps.post_id = p.id and ps.style_id in (select style_id from my_styles)
          ) then 0.5 else 0 end
        -- Günlük değişen sabit tohum: sayfalar arasında tutarlı, günden güne farklı.
        + (abs(hashtext(p.id::text || current_date::text)) % 1000) / 10000.0
      end as score
    from public.posts p
    join public.profiles pr on pr.id = p.user_id
    where p.visibility = 'public'
      and p.moderation_status = 'active'
      and not pr.is_private
      and p.user_id <> auth.uid()
      and p.created_at > now() - interval '60 days'
      and not exists (select 1 from public.hidden_posts h where h.user_id = auth.uid() and h.post_id = p.id)
      and (p_style is null or exists (
        select 1 from public.post_styles ps join public.styles s on s.id = ps.style_id
        where ps.post_id = p.id and s.slug = p_style
      ))
      and (not p_only_unfollowed or not exists (
        select 1 from public.follows f
        where f.follower_id = auth.uid() and f.following_id = p.user_id
      ))
  ),
  ranked as (
    select c.*, row_number() over (partition by c.user_id order by c.score desc) as author_rank
    from candidates c
  )
  select id, user_id, caption, visibility, comments_enabled, outfit_details, moderation_status,
         like_count, comment_count, save_count, created_at, updated_at
  from ranked
  where author_rank <= 2
  order by score desc, id
  offset greatest(p_offset, 0)
  limit least(greatest(p_limit, 1), 50);
$$;

create function public.suggested_profiles(p_limit int default 10)
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
    (select count(*) from public.user_styles us
      where us.user_id = pr.id
        and us.style_id in (select style_id from public.user_styles where user_id = auth.uid())) desc,
    pr.follower_count desc,
    pr.created_at desc
  limit least(greatest(p_limit, 1), 30);
$$;

create function public.search_profiles(p_query text, p_limit int default 20)
returns setof public.profiles
language sql stable security invoker set search_path = ''
as $$
  select pr.* from public.profiles pr
  where char_length(btrim(p_query)) >= 1
    and (
      pr.username like lower(ltrim(btrim(p_query), '@')) || '%'
      or pr.username operator(extensions.%) lower(ltrim(btrim(p_query), '@'))
      or lower(pr.display_name) like '%' || lower(btrim(p_query)) || '%'
    )
  order by
    (pr.username = lower(ltrim(btrim(p_query), '@'))) desc,
    extensions.similarity(pr.username, lower(ltrim(btrim(p_query), '@'))) desc,
    pr.follower_count desc
  limit least(greatest(p_limit, 1), 50);
$$;

-- ---------------------------------------------------------------------------
-- Yönetim fonksiyonları (yalnızca personel)
-- ---------------------------------------------------------------------------

create function public.admin_set_post_status(
  p_post_id uuid, p_status public.moderation_status, p_note text default null, p_report_id uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Yetkisiz işlem.' using errcode = '42501';
  end if;
  update public.posts set moderation_status = p_status where id = p_post_id;
  insert into public.moderation_actions (actor_id, action, target_post_id, report_id, note)
  values (auth.uid(), 'post_' || p_status::text, p_post_id, p_report_id, p_note);
end;
$$;

create function public.admin_set_account_status(
  p_user_id uuid, p_status public.account_status, p_note text default null, p_report_id uuid default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Yetkisiz işlem.' using errcode = '42501';
  end if;
  if p_status = 'banned' and not exists (
    select 1 from public.staff where user_id = auth.uid() and role = 'admin'
  ) then
    raise exception 'Hesap kapatma yalnızca yöneticiler tarafından yapılabilir.' using errcode = '42501';
  end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  insert into public.moderation_actions (actor_id, action, target_user_id, report_id, note)
  values (auth.uid(), 'account_' || p_status::text, p_user_id, p_report_id, p_note);
end;
$$;

create function public.admin_resolve_report(
  p_report_id uuid, p_status public.report_status, p_note text default null
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'Yetkisiz işlem.' using errcode = '42501';
  end if;
  update public.reports
  set status = p_status, reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_report_id;
  insert into public.moderation_actions (actor_id, action, report_id, note)
  values (auth.uid(), 'report_' || p_status::text, p_report_id, p_note);
end;
$$;

-- Fonksiyon çağırma yetkileri: varsayılan PUBLIC yetkisi kaldırılır.
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

-- ---------------------------------------------------------------------------
-- Depolama
-- ---------------------------------------------------------------------------
-- avatars: herkese açık okunur (profil fotoğrafı arama sonuçlarında da görünür).
-- post-images: özel. Görseller kısa süreli imzalı bağlantılarla sunulur ve
-- okuma yetkisi gönderinin görünürlük kurallarına bağlıdır.
-- İstemci her görseli JPEG olarak yeniden kodlar; bu işlem EXIF ve konum
-- bilgisini siler. Bu yüzden yalnızca image/jpeg kabul edilir.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 2097152, array['image/jpeg']),
  ('post-images', 'post-images', false, 8388608, array['image/jpeg'])
on conflict (id) do nothing;

create policy "avatars: herkes okur" on storage.objects
  for select to anon, authenticated using (bucket_id = 'avatars');
create policy "avatars: sahibi yükler" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars: sahibi günceller" on storage.objects
  for update to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "avatars: sahibi siler" on storage.objects
  for delete to authenticated using (
    bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Yol biçimi: {user_id}/{post_id}/{dosya}.jpg
create function public.can_read_post_object(object_name text)
returns boolean
language plpgsql stable security definer set search_path = ''
as $$
declare
  parts text[] := storage.foldername(object_name);
  target_post uuid;
begin
  if parts[1] = auth.uid()::text then
    return true;
  end if;
  begin
    target_post := parts[2]::uuid;
  exception when others then
    return false;
  end;
  return public.can_view_post(target_post);
end;
$$;

grant execute on function public.can_read_post_object(text) to authenticated;

create policy "post-images: görünür gönderi" on storage.objects
  for select to authenticated using (
    bucket_id = 'post-images' and public.can_read_post_object(name)
  );
create policy "post-images: sahibi yükler" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "post-images: sahibi siler" on storage.objects
  for delete to authenticated using (
    bucket_id = 'post-images' and (storage.foldername(name))[1] = auth.uid()::text
  );
