-- 0014: 엑셀 일정 일괄 업로드 (등록 함수 1개 + 업로드 이력 표 1개)
-- 0001~0008을 먼저 실행한 뒤 SQL Editor에서 실행하세요. 여러 번 실행해도 안전해요(create or replace / if not exists).
-- 기존 표(공연·배역·배우·회차·캐스팅)의 구조는 바꾸지 않아요. 새 표 1개와 함수 1개만 추가해요.
--
-- 되돌리기(필요하면):
--   drop function if exists public.import_schedule(text, text, integer, integer, jsonb, boolean, text, jsonb);
--   drop table if exists public.schedule_imports;
--
-- import_schedule 은 security invoker 라 호출한 사람의 권한(RLS)으로 실행되고, 안에서도 public.is_admin()을 확인해요.
-- 함수 하나는 하나의 트랜잭션이라 중간에 오류가 나면 이번 업로드로 만든 것이 전부 되돌려져요(일부만 등록되지 않아요).

create table if not exists public.schedule_imports (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  file_name text not null default '' check (char_length(file_name) <= 200),
  file_hash text not null default '' check (char_length(file_hash) <= 80),
  total_rows integer not null default 0,
  error_rows integer not null default 0,
  new_shows integer not null default 0,
  existing_shows integer not null default 0,
  new_sessions integer not null default 0,
  existing_sessions integer not null default 0,
  updated_casts integer not null default 0,
  new_roles integer not null default 0,
  new_actors integer not null default 0,
  link_events integer not null default 0,
  update_cast boolean not null default false,
  skipped jsonb not null default '[]'::jsonb
);
create index if not exists schedule_imports_created_idx on public.schedule_imports (created_at desc);
create index if not exists schedule_imports_hash_idx on public.schedule_imports (file_hash);

alter table public.schedule_imports enable row level security;
drop policy if exists "admin read" on public.schedule_imports;
create policy "admin read" on public.schedule_imports for select to authenticated using ((select public.is_admin()));
drop policy if exists "admin insert" on public.schedule_imports;
create policy "admin insert" on public.schedule_imports for insert to authenticated with check ((select public.is_admin()));
revoke all on public.schedule_imports from anon, authenticated;
grant select, insert on public.schedule_imports to authenticated;

-- p_shows: [{ title, mode: 'existing'|'new', show_id?, force_new?, venue, start, end, genre, link?,
--             sessions: [{ date, time, cast: [{ role, actor }] }] }]
-- 공연 찾기: mode='existing' 이면 show_id 그대로. mode='new' 이고 force_new 가 아니면, 같은 이름(공백·대소문자 무시)의 공연이 이미 있을 때 새로 만들지 않고 그 공연을 써요(같은 파일 재업로드·동시 업로드 대비).
-- 회차 찾기: (공연, 날짜, 시간)이 같으면 기존 회차. 기존 회차는 새로 만들지 않고, p_update_cast=false(기본)이면 캐스팅도 건드리지 않아요.
-- 배역·배우: 이름(공백·대소문자 무시)으로 찾고, 없으면 만들어요. 한 회차의 같은 배역은 한 명만 들어가요.
-- p_link_event_title 이 비어 있지 않으면, 공지 링크가 있는 공연에 그 제목의 이벤트(공연 기간 전체)를 하나 만들어요(같은 공연·같은 링크의 이벤트가 이미 있으면 건너뜀).
create or replace function public.import_schedule(
  p_file_name text, p_file_hash text, p_total_rows integer, p_error_rows integer, p_skipped jsonb,
  p_update_cast boolean, p_link_event_title text, p_shows jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  sh jsonb; se jsonb; ce jsonb;
  v_show uuid; v_new boolean; v_sid uuid; v_role uuid; v_cm uuid; v_cur uuid; v_inserted boolean;
  v_key text; v_rname text; v_aname text;
  n_new_shows integer := 0; n_old_shows integer := 0; n_new_sessions integer := 0; n_old_sessions integer := 0;
  n_updated integer := 0; n_roles integer := 0; n_actors integer := 0; n_links integer := 0; n_sessions_total integer := 0;
  v_link text; v_start date; v_end date; v_log uuid; v_has_events boolean := to_regclass('public.events') is not null;
begin
  if not (select public.is_admin()) then raise exception 'permission denied: admin only'; end if;
  if jsonb_typeof(p_shows) is distinct from 'array' then raise exception 'p_shows must be a json array'; end if;

  for sh in select * from jsonb_array_elements(p_shows) loop
    v_show := null; v_new := false;
    if sh ->> 'mode' = 'existing' and nullif(sh ->> 'show_id', '') is not null then
      v_show := (sh ->> 'show_id')::uuid;
      if not exists (select 1 from public.shows where id = v_show) then raise exception 'show not found: %', sh ->> 'show_id'; end if;
    else
      if coalesce((sh ->> 'force_new')::boolean, false) is not true then
        select id into v_show from public.shows
         where regexp_replace(lower(title), '\s', '', 'g') = regexp_replace(lower(sh ->> 'title'), '\s', '', 'g')
         order by created_at limit 1;
      end if;
      if v_show is null then
        insert into public.shows (title, genre, start_date, end_date, venue)
        values (btrim(sh ->> 'title'), coalesce(nullif(sh ->> 'genre', ''), '뮤지컬'), nullif(sh ->> 'start', '')::date, nullif(sh ->> 'end', '')::date, coalesce(sh ->> 'venue', ''))
        returning id into v_show;
        v_new := true;
      end if;
    end if;
    if v_new then n_new_shows := n_new_shows + 1; else n_old_shows := n_old_shows + 1; end if;

    for se in select * from jsonb_array_elements(coalesce(sh -> 'sessions', '[]'::jsonb)) loop
      n_sessions_total := n_sessions_total + 1;
      if n_sessions_total > 5000 then raise exception 'too many sessions (max 5000)'; end if;
      insert into public.sessions (show_id, starts_on, starts_at)
      values (v_show, (se ->> 'date')::date, (se ->> 'time')::time)
      on conflict (show_id, starts_on, starts_at) do nothing
      returning id into v_sid;
      v_inserted := v_sid is not null;
      if not v_inserted then
        select id into v_sid from public.sessions where show_id = v_show and starts_on = (se ->> 'date')::date and starts_at = (se ->> 'time')::time;
        n_old_sessions := n_old_sessions + 1;
        if not coalesce(p_update_cast, false) then continue; end if;
      else
        n_new_sessions := n_new_sessions + 1;
      end if;

      for ce in select * from jsonb_array_elements(coalesce(se -> 'cast', '[]'::jsonb)) loop
        v_rname := btrim(coalesce(ce ->> 'role', '')); v_aname := btrim(coalesce(ce ->> 'actor', ''));
        if v_rname = '' or v_aname = '' then continue; end if;
        v_key := regexp_replace(lower(v_rname), '\s', '', 'g');
        select id into v_role from public.roles where show_id = v_show and regexp_replace(lower(name), '\s', '', 'g') = v_key order by sort_order, id limit 1;
        if v_role is null then
          insert into public.roles (show_id, name, short_name, sort_order)
          values (v_show, v_rname, coalesce(nullif(split_part(regexp_replace(v_rname, '[·\s]+', ' ', 'g'), ' ', 1), ''), v_rname),
                  coalesce((select max(sort_order) + 1 from public.roles where show_id = v_show), 0))
          returning id into v_role;
          n_roles := n_roles + 1;
        end if;
        v_key := regexp_replace(lower(v_aname), '\s', '', 'g');
        select id into v_cm from public.cast_members where role_id = v_role and regexp_replace(lower(name), '\s', '', 'g') = v_key order by sort_order, id limit 1;
        if v_cm is null then
          insert into public.cast_members (role_id, name, sort_order)
          values (v_role, v_aname, coalesce((select max(sort_order) + 1 from public.cast_members where role_id = v_role), 0))
          returning id into v_cm;
          n_actors := n_actors + 1;
        end if;
        if v_inserted then
          insert into public.session_cast (session_id, role_id, cast_member_id) values (v_sid, v_role, v_cm)
          on conflict (session_id, role_id) do nothing;
        else
          select cast_member_id into v_cur from public.session_cast where session_id = v_sid and role_id = v_role;
          if not exists (select 1 from public.session_cast where session_id = v_sid and role_id = v_role) then
            insert into public.session_cast (session_id, role_id, cast_member_id) values (v_sid, v_role, v_cm); n_updated := n_updated + 1;
          elsif v_cur is distinct from v_cm then
            update public.session_cast set cast_member_id = v_cm where session_id = v_sid and role_id = v_role; n_updated := n_updated + 1;
          end if;
        end if;
      end loop;
    end loop;

    v_link := nullif(btrim(coalesce(sh ->> 'link', '')), '');
    if v_link is not null and nullif(btrim(coalesce(p_link_event_title, '')), '') is not null and v_has_events then
      if not exists (select 1 from public.events where show_id = v_show and link_url = v_link) then
        select start_date, end_date into v_start, v_end from public.shows where id = v_show;
        execute 'insert into public.events (title, starts_on, ends_on, link_url, show_id) values ($1, $2, $3, $4, $5)'
          using btrim(p_link_event_title), v_start, v_end, v_link, v_show;
        n_links := n_links + 1;
      end if;
    end if;
  end loop;

  insert into public.schedule_imports (file_name, file_hash, total_rows, error_rows, new_shows, existing_shows, new_sessions, existing_sessions,
                                       updated_casts, new_roles, new_actors, link_events, update_cast, skipped)
  values (left(coalesce(p_file_name, ''), 200), left(coalesce(p_file_hash, ''), 80), coalesce(p_total_rows, 0), coalesce(p_error_rows, 0),
          n_new_shows, n_old_shows, n_new_sessions, n_old_sessions, n_updated, n_roles, n_actors, n_links, coalesce(p_update_cast, false),
          coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements(coalesce(p_skipped, '[]'::jsonb)) x limit 300) q), '[]'::jsonb))
  returning id into v_log;

  return jsonb_build_object('log_id', v_log, 'new_shows', n_new_shows, 'existing_shows', n_old_shows, 'new_sessions', n_new_sessions,
    'existing_sessions', n_old_sessions, 'updated_casts', n_updated, 'new_roles', n_roles, 'new_actors', n_actors, 'link_events', n_links);
end $$;

revoke execute on function public.import_schedule(text, text, integer, integer, jsonb, boolean, text, jsonb) from public, anon;
grant execute on function public.import_schedule(text, text, integer, integer, jsonb, boolean, text, jsonb) to authenticated;
