-- 0004: 이벤트(events) 표와 팝업 광고(popups) 표
-- 0001, 0003을 먼저 실행한 뒤 이 파일을 SQL Editor에서 한 번 실행하세요. 여러 번 실행해도 안전해요.
--
-- 권한 구조는 다른 표와 같아요. 추가·수정·삭제는 관리자(public.admins 등록 계정)만 할 수 있어요.
--   events : 읽기는 누구나.
--   popups : 읽기는 '켜 둔 것(active)'만 누구나, 꺼 둔 것까지 모두 보는 건 관리자만.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 100),
  body text not null default '' check (char_length(body) <= 2000),
  place text not null default '' check (char_length(place) <= 100),
  starts_on date,
  ends_on date,
  link_url text check (link_url is null or (char_length(link_url) <= 500 and link_url ~* '^https?://')),
  show_id uuid references public.shows (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);
create index if not exists events_period_idx on public.events (ends_on, starts_on);

create table if not exists public.popups (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 60),
  body text not null default '' check (char_length(body) <= 300),
  label text not null default '' check (char_length(label) <= 40),
  cta text not null default '자세히 보기' check (char_length(cta) between 1 and 20),
  link_url text check (link_url is null or (char_length(link_url) <= 500 and link_url ~* '^https?://')),
  image_url text check (image_url is null or (char_length(image_url) <= 500 and image_url ~* '^https?://')),
  gradient text not null default '#3b1d5a,#c2410c' check (gradient ~ '^#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}$'),
  starts_on date,
  ends_on date,
  active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (starts_on is null or ends_on is null or ends_on >= starts_on)
);
create index if not exists popups_order_idx on public.popups (sort_order, created_at);

drop trigger if exists events_touch on public.events;
create trigger events_touch before update on public.events for each row execute function public.touch_updated_at();
drop trigger if exists popups_touch on public.popups;
create trigger popups_touch before update on public.popups for each row execute function public.touch_updated_at();

alter table public.events enable row level security;
alter table public.popups enable row level security;
drop policy if exists "public read" on public.events;
drop policy if exists "admin insert" on public.events;
drop policy if exists "admin update" on public.events;
drop policy if exists "admin delete" on public.events;
create policy "public read" on public.events for select to anon, authenticated using (true);
create policy "admin insert" on public.events for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.events for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete" on public.events for delete to authenticated using ((select public.is_admin()));

drop policy if exists "public read active" on public.popups;
drop policy if exists "admin read all" on public.popups;
drop policy if exists "admin insert" on public.popups;
drop policy if exists "admin update" on public.popups;
drop policy if exists "admin delete" on public.popups;
create policy "public read active" on public.popups for select to anon, authenticated using (active);
create policy "admin read all" on public.popups for select to authenticated using ((select public.is_admin()));
create policy "admin insert" on public.popups for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.popups for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete" on public.popups for delete to authenticated using ((select public.is_admin()));

revoke all on public.events from anon, authenticated;
revoke all on public.popups from anon, authenticated;
grant select on public.events to anon, authenticated;
grant select on public.popups to anon, authenticated;
grant insert, update, delete on public.events to authenticated;
grant insert, update, delete on public.popups to authenticated;
