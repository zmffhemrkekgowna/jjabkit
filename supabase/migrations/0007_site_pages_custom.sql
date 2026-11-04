-- 0007: 안내 페이지를 관리자가 자유롭게 추가·삭제할 수 있게 해요.
-- 0005를 먼저 실행한 뒤 SQL Editor에서 한 번 실행하세요. 여러 번 실행해도 안전해요.
-- - 주소(slug)를 소개·개인정보처리방침·문의 3개로만 제한하던 규칙을 풀고, 영문 소문자·숫자·하이픈(최대 40자)만 허용해요.
-- - 추가한 순서대로 보여주기 위해 만든 때(created_at) 열을 더해요.
-- 읽기는 누구나, 추가·수정·삭제는 관리자만이에요(0005의 규칙 그대로).

alter table public.site_pages drop constraint if exists site_pages_slug_check;
alter table public.site_pages add constraint site_pages_slug_check check (slug ~ '^[a-z0-9][a-z0-9-]{0,39}$');
alter table public.site_pages add column if not exists created_at timestamptz not null default now();
