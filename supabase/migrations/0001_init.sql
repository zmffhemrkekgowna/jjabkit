-- JJabKit 개인용 스키마: 공연 / 배역 / 배우 / 회차 / 회차별 캐스팅
-- Supabase는 PostgreSQL 15 이상을 쓰므로 복합 외래키의 ON DELETE SET NULL (컬럼) 문법을 사용해요.

create table public.shows (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  genre text not null default '뮤지컬' check (genre in ('뮤지컬', '연극')),
  status text not null default 'upcoming' check (status in ('running', 'upcoming')),
  start_date date,
  end_date date,
  venue text not null default '',
  region text not null default '서울',
  age_rating text not null default '',
  runtime_text text not null default '',
  early_bird_text text not null default '',
  poster_url text,
  poster_palette text not null default '#1c2b4a,#3b1d4f,#8B1E3F',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  name text not null,
  short_name text not null default '',
  sort_order int not null default 0
);

create table public.cast_members (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references public.roles (id) on delete cascade,
  name text not null,
  sort_order int not null default 0,
  unique (id, role_id)
);

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  show_id uuid not null references public.shows (id) on delete cascade,
  starts_on date not null,
  starts_at time not null,
  is_curtain_call boolean not null default false,
  is_time_sale boolean not null default false,
  unique (show_id, starts_on, starts_at)
);

-- 회차 x 배역 = 배우 한 명. cast_member_id가 null이면 '미정'.
-- 복합 외래키로 "그 배역에 속한 배우만" 지정할 수 있게 막아요. 배우를 삭제하면 미정으로 바뀌어요.
create table public.session_cast (
  session_id uuid not null references public.sessions (id) on delete cascade,
  role_id uuid not null references public.roles (id) on delete cascade,
  cast_member_id uuid,
  primary key (session_id, role_id),
  foreign key (cast_member_id, role_id)
    references public.cast_members (id, role_id)
    on delete set null (cast_member_id)
);

create index roles_show_idx on public.roles (show_id);
create index cast_members_role_idx on public.cast_members (role_id);
create index sessions_show_date_idx on public.sessions (show_id, starts_on);
create index session_cast_member_idx on public.session_cast (cast_member_id, role_id);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger shows_touch before update on public.shows
for each row execute function public.touch_updated_at();

-- 관리자: 가입은 열려 있어도 이 표에 등록된 계정만 쓰기가 가능해요.
create table public.admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()))
$$;

-- 회차 저장(추가/수정)을 한 번에: 회차 + 배역별 배우를 같은 트랜잭션으로 처리
create function public.save_session(
  p_id uuid, p_show_id uuid, p_date date, p_time time,
  p_curtain boolean, p_timesale boolean, p_cast jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid;
begin
  if p_id is null then
    insert into public.sessions (show_id, starts_on, starts_at, is_curtain_call, is_time_sale)
    values (p_show_id, p_date, p_time, p_curtain, p_timesale)
    returning id into v_id;
  else
    update public.sessions
       set starts_on = p_date, starts_at = p_time,
           is_curtain_call = p_curtain, is_time_sale = p_timesale
     where id = p_id and show_id = p_show_id
    returning id into v_id;
    if v_id is null then
      raise exception 'session not found';
    end if;
    delete from public.session_cast where session_id = v_id;
  end if;

  insert into public.session_cast (session_id, role_id, cast_member_id)
  select v_id, key::uuid, nullif(value, '')::uuid
  from jsonb_each_text(coalesce(p_cast, '{}'::jsonb));

  return v_id;
end $$;

-- RLS: 읽기는 누구나, 쓰기는 관리자만
alter table public.admins enable row level security;

do $$
declare t text;
begin
  foreach t in array array['shows', 'roles', 'cast_members', 'sessions', 'session_cast'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "public read" on public.%I for select to anon, authenticated using (true)', t);
    execute format('create policy "admin insert" on public.%I for insert to authenticated with check ((select public.is_admin()))', t);
    execute format('create policy "admin update" on public.%I for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()))', t);
    execute format('create policy "admin delete" on public.%I for delete to authenticated using ((select public.is_admin()))', t);
  end loop;
end $$;

grant usage on schema public to anon, authenticated;
grant select on public.shows, public.roles, public.cast_members, public.sessions, public.session_cast to anon, authenticated;
grant insert, update, delete on public.shows, public.roles, public.cast_members, public.sessions, public.session_cast to authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.save_session(uuid, uuid, date, time, boolean, boolean, jsonb) from public, anon;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.save_session(uuid, uuid, date, time, boolean, boolean, jsonb) to authenticated;

-- 포스터 이미지 저장소 (공개 읽기, 업로드/수정/삭제는 관리자만)
insert into storage.buckets (id, name, public) values ('posters', 'posters', true)
on conflict (id) do nothing;

create policy "posters admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and (select public.is_admin()));
create policy "posters admin update" on storage.objects for update to authenticated
  using (bucket_id = 'posters' and (select public.is_admin()));
create policy "posters admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and (select public.is_admin()));

-- ---------------------------------------------------------------------------
-- 권한 정리: Supabase는 새 표에 anon·authenticated 권한을 기본으로 붙이므로 필요한 것만 남기고 회수해요.
--   공개(anon)·일반 로그인 계정 : 5개 표 읽기만
--   관리자(public.admins 등록)  : 5개 표 쓰기 (실제 허용 여부는 위 RLS의 is_admin()이 결정)
--   admins 표                   : 아무도 API로 읽거나 쓸 수 없음 (SQL Editor에서만 관리)
-- ---------------------------------------------------------------------------
revoke all on public.admins from anon, authenticated;
revoke insert, update, delete, truncate on public.shows, public.roles, public.cast_members, public.sessions, public.session_cast from anon;
revoke truncate on public.shows, public.roles, public.cast_members, public.sessions, public.session_cast from authenticated;
