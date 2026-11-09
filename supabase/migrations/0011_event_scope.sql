-- 0011: 이벤트 적용 범위 (전체 회차 / 특정 기간 / 특정 회차)
-- 0004를 먼저 실행한 뒤 SQL Editor에서 실행하세요. 여러 번 실행해도 안전해요.
-- 기존 이벤트는 하나도 바뀌지 않아요: 지금까지처럼 '시작일~종료일 사이의 모든 회차'(scope = 'range')로 남아요.
-- 표·정책·다른 칸은 건드리지 않고 칸 2개만 추가해요.
--   scope        : 'all'(공연의 모든 회차) | 'range'(시작일~종료일 기간의 회차, 기존 방식) | 'sessions'(고른 회차만)
--   session_keys : scope = 'sessions'일 때 고른 회차 목록. "YYYY-MM-DD HH:MM" 형식의 날짜+시작 시간이에요.
--                  회차 id가 아니라 날짜+시간으로 저장해서, 백업 복원으로 회차 id가 새로 만들어져도 그대로 이어져요.
--
-- 되돌리기(필요하면): alter table public.events drop column if exists session_keys, drop column if exists scope;

alter table public.events add column if not exists scope text not null default 'range';
alter table public.events add column if not exists session_keys text[];

alter table public.events drop constraint if exists events_scope_check;
alter table public.events add constraint events_scope_check check (scope in ('all', 'range', 'sessions'));

alter table public.events drop constraint if exists events_session_keys_check;
alter table public.events add constraint events_session_keys_check check (
  (scope = 'sessions' and session_keys is not null and cardinality(session_keys) between 1 and 500
     and array_to_string(session_keys, ',') ~ '^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(,\d{4}-\d{2}-\d{2} \d{2}:\d{2})*$')
  or (scope <> 'sessions' and (session_keys is null or cardinality(session_keys) = 0))
);

-- 예전 화면·백업 복원처럼 scope를 비워서 넣는 경우에도 기존 방식('range')으로 들어가게 해요.
create or replace function public.events_scope_default() returns trigger language plpgsql as $$
begin
  if new.scope is null then new.scope := 'range'; end if;
  if new.scope <> 'sessions' and new.session_keys is not null and cardinality(new.session_keys) = 0 then new.session_keys := null; end if;
  return new;
end $$;
drop trigger if exists events_scope_default on public.events;
create trigger events_scope_default before insert or update on public.events for each row execute function public.events_scope_default();
