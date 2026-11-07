-- 0010: 익명 방문 통계 (페이지뷰 집계)
-- 0001~0009를 먼저 실행한 뒤 SQL Editor에서 실행하세요. 여러 번 실행해도 안전해요.
-- 기존 표·함수·정책은 바꾸지 않아요. 표 1개, 함수 2개만 추가해요.
--
-- 개인정보 원칙: 아래 표에는 "날짜 · 페이지 유형 · 공연 ID · 횟수"만 있어요.
--   IP, 쿠키, 브라우저·기기 식별값, User-Agent, 계정 ID, 접속 경로 원문은 저장하지 않아요(저장할 칸 자체가 없어요).
--   방문자를 구분하지 않으므로 순방문자(UV)는 계산할 수 없고, 모든 접속은 각각 페이지뷰 1회예요.
--
-- 되돌리기(필요하면):
--   drop function if exists public.record_pageview(text, uuid);
--   drop function if exists public.get_pageview_stats();
--   drop table if exists public.page_views_daily;

create table if not exists public.page_views_daily (
  view_date date   not null,                                   -- 한국 시간(KST) 기준 날짜
  page_type text  not null check (page_type in ('home','today','show','my','backup','guide','info','other')),
  show_id   uuid,                                              -- 공연 상세(show)일 때만. 공연이 지워져도 집계는 남기려고 외래키는 걸지 않아요
  views     bigint not null default 0 check (views >= 0),
  check ((page_type = 'show') = (show_id is not null))
);
-- 날짜 + 유형 + 공연별로 한 줄만 (show_id가 비어 있는 줄도 하나만 되도록 빈 값을 0 UUID로 취급)
create unique index if not exists page_views_daily_key
  on public.page_views_daily (view_date, page_type, (coalesce(show_id, '00000000-0000-0000-0000-000000000000'::uuid)));
create index if not exists page_views_daily_show on public.page_views_daily (show_id) where show_id is not null;

alter table public.page_views_daily enable row level security;
drop policy if exists "admin read" on public.page_views_daily;
create policy "admin read" on public.page_views_daily for select to authenticated using ((select public.is_admin()));
-- 쓰기 정책은 일부러 만들지 않아요: API로는 아무도(관리자도) 직접 고칠 수 없고, 아래 record_pageview 함수로만 1씩 올라가요.
revoke all on public.page_views_daily from anon, authenticated;
grant select on public.page_views_daily to authenticated;

-- 페이지뷰 1회 기록. 서버(Next.js /api/pv)가 호출해요.
--  · 허용된 유형만, 공연 상세는 실제 있는 공연 ID만 기록해요(엉뚱한 값은 조용히 무시).
--  · 관리자(로그인한 관리자 계정)의 접속은 기록하지 않아요.
--  · 어떤 오류가 나도 예외를 밖으로 내보내지 않아요(통계 때문에 사이트 이용이 막히면 안 돼요).
create or replace function public.record_pageview(p_type text, p_show_id uuid default null) returns void
language plpgsql security definer set search_path = '' as $$
declare v_day date := (now() at time zone 'Asia/Seoul')::date;
begin
  if p_type is null or p_type not in ('home','today','show','my','backup','guide','info','other') then return; end if;
  if p_type = 'show' then
    if p_show_id is null or not exists (select 1 from public.shows where id = p_show_id) then return; end if;
  else
    p_show_id := null;
  end if;
  if (select public.is_admin()) then return; end if;
  insert into public.page_views_daily as t (view_date, page_type, show_id, views)
  values (v_day, p_type, p_show_id, 1)
  on conflict (view_date, page_type, (coalesce(show_id, '00000000-0000-0000-0000-000000000000'::uuid)))
  do update set views = t.views + 1;
exception when others then
  return;
end $$;

-- 관리자 화면용 통계. 호출한 사람의 권한으로 실행되고(security invoker), 관리자가 아니면 거절해요.
create or replace function public.get_pageview_stats() returns jsonb
language plpgsql stable security invoker set search_path = '' as $$
declare v_today date := (now() at time zone 'Asia/Seoul')::date; r jsonb;
begin
  if not (select public.is_admin()) then raise exception 'permission denied: admin only'; end if;
  select jsonb_build_object(
    'today_date', v_today,
    'today',     coalesce((select sum(views) from public.page_views_daily where view_date = v_today), 0),
    'yesterday', coalesce((select sum(views) from public.page_views_daily where view_date = v_today - 1), 0),
    'month',     coalesce((select sum(views) from public.page_views_daily where view_date >= date_trunc('month', v_today)::date and view_date <= v_today), 0),
    'total',     coalesce((select sum(views) from public.page_views_daily), 0),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('d', g.d, 'v', coalesce(x.v, 0)) order by g.d desc), '[]'::jsonb)
        from (select v_today - n as d from generate_series(0, 89) as n) g
        left join (select view_date, sum(views) as v from public.page_views_daily group by view_date) x on x.view_date = g.d
    ),
    'shows', (
      select coalesce(jsonb_agg(jsonb_build_object('id', q.id, 'title', q.title, 'views', q.views) order by q.views desc, q.title nulls last, q.id), '[]'::jsonb)
        from (
          select coalesce(s.id, v.show_id) as id, s.title, coalesce(v.views, 0) as views
            from public.shows s
            full join (select show_id, sum(views) as views from public.page_views_daily where page_type = 'show' group by show_id) v on v.show_id = s.id
        ) q
    )
  ) into r;
  return r;
end $$;

revoke execute on function public.record_pageview(text, uuid) from public;
revoke execute on function public.get_pageview_stats() from public, anon;
grant execute on function public.record_pageview(text, uuid) to anon, authenticated;
grant execute on function public.get_pageview_stats() to authenticated;
