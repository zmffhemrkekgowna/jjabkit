-- 0018: 공연 장르에 '콘서트' 추가
-- shows.genre의 CHECK 제약조건만 바꿔요. 공연·회차·배우·기록 데이터는 삭제하거나 고치지 않아요.
-- 먼저 supabase/checks/0018_genre_constraint_check.sql 로 현재 제약조건을 확인한 뒤 실행하세요.
--
-- 제약조건 이름을 가정하지 않아요: shows 테이블에서 genre를 검사하는 CHECK를 찾아 그 이름 그대로 지우고,
-- 같은 자리에 뮤지컬·연극·콘서트를 허용하는 제약조건(shows_genre_check)을 다시 만들어요.
-- 한 번에(한 트랜잭션으로) 실행돼서, 중간에 실패하면 기존 제약조건이 그대로 남아요. 여러 번 실행해도 같은 결과예요.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.shows'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%genre%'
  loop
    execute format('alter table public.shows drop constraint %I', c.conname);
  end loop;
  alter table public.shows add constraint shows_genre_check check (genre in ('뮤지컬', '연극', '콘서트'));
end $$;

-- 확인: 아래 한 줄에 뮤지컬·연극·콘서트가 모두 보이면 성공이에요.
select conname as "제약조건 이름", pg_get_constraintdef(oid) as "내용"
from pg_constraint
where conrelid = 'public.shows'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%genre%';
