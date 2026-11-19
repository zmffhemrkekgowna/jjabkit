-- 0018 실행 전 확인용 (읽기 전용: 아무것도 바꾸지 않아요)
-- Supabase 대시보드 → SQL Editor에 붙여넣어 실행하세요.
-- 1) shows.genre에 걸려 있는 CHECK 제약조건의 실제 이름과 내용
select conname as "제약조건 이름", pg_get_constraintdef(oid) as "내용"
from pg_constraint
where conrelid = 'public.shows'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%genre%';

-- 2) 지금 저장된 장르별 공연 수 (뮤지컬·연극 외의 값이 있으면 0018이 실패하니 먼저 알려 주세요)
select genre as "장르", count(*) as "공연 수" from public.shows group by genre order by 1;
