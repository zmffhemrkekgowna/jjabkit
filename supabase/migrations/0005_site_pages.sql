-- 0005: 안내 페이지(소개·개인정보처리방침·문의) 문구 표
-- 0001, 0003을 먼저 실행한 뒤 이 파일을 SQL Editor에서 한 번 실행하세요. 여러 번 실행해도 안전해요.
-- 읽기는 누구나, 수정은 관리자(public.admins 등록 계정)만. 행이 없으면 앱이 기본 문구를 보여줘요.

create table if not exists public.site_pages (
  slug text primary key check (slug in ('about', 'privacy', 'contact')),
  title text not null check (char_length(title) between 1 and 60),
  body text not null default '' check (char_length(body) <= 20000),
  updated_at timestamptz not null default now()
);

drop trigger if exists site_pages_touch on public.site_pages;
create trigger site_pages_touch before update on public.site_pages for each row execute function public.touch_updated_at();

alter table public.site_pages enable row level security;
drop policy if exists "public read" on public.site_pages;
drop policy if exists "admin insert" on public.site_pages;
drop policy if exists "admin update" on public.site_pages;
drop policy if exists "admin delete" on public.site_pages;
create policy "public read" on public.site_pages for select to anon, authenticated using (true);
create policy "admin insert" on public.site_pages for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.site_pages for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete" on public.site_pages for delete to authenticated using ((select public.is_admin()));

revoke all on public.site_pages from anon, authenticated;
grant select on public.site_pages to anon, authenticated;
grant insert, update, delete on public.site_pages to authenticated;
