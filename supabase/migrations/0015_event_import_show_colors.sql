-- 0015: 이벤트 일괄 등록 + 공연별 색 자동 배정
-- 0001~0014를 먼저 실행한 뒤 SQL Editor에서 한 번 실행하세요. 여러 번 실행해도 안전해요(create or replace / if not exists / 비어 있는 색만 채움).
--
-- 이 파일이 하는 일
--  1) 공연 색 자동 배정: shows.schedule_color(0009)가 비어 있는 공연에 팔레트 색을 한 번 정해 저장해요.
--     · 새 공연이 만들어질 때(직접 추가·엑셀 등록·백업 복원 모두) 비어 있으면 자동으로 채워요.
--     · 지금 있는 공연 중 색이 비어 있는 공연도 이 파일을 실행할 때 한 번만 채워요(이미 색이 있는 공연은 건드리지 않아요).
--     · 색은 가장 적게 쓰인 팔레트 색부터 순서대로 골라서 서로 다른 공연이 같은 색을 최대한 덜 쓰게 해요. 무작위가 아니라서 화면을 열 때마다 바뀌지 않아요.
--     · 직접 고른 색(저장된 색)은 어떤 경우에도 덮어쓰지 않아요. 공연명을 바꿔도 색은 그대로예요.
--  2) 이벤트 일괄 등록: import_schedule 함수가 이벤트 목록(p_events)도 함께 받아요(일정과 이벤트가 한 번의 트랜잭션).
--     · 같은 공연에 같은 이벤트명·같은 기간이 이미 있으면 새로 만들지 않고 건너뛰어요. 이벤트명이 같아도 기간이 다르면 별개의 이벤트예요.
--     · 이벤트 기간이 겹쳐도 등록돼요. 이벤트는 공연 기간과 별개로 관리돼요. 기존 이벤트는 지우거나 바꾸지 않아요.
--  3) 업로드 이력 표에 새 이벤트 수 칸 2개 추가.
-- 기존 공연·회차·배우·이벤트 데이터는 지우거나 바꾸지 않아요(비어 있던 색 칸만 채워요).
--
-- 되돌리기(필요하면):
--   drop trigger if exists shows_auto_color on public.shows;
--   drop function if exists public.shows_auto_color();
--   drop function if exists public.pick_show_color();
--   (자동으로 채워진 색을 지우려면 직접 고른 색과 구분이 안 되므로 권장하지 않아요. 앱의 '포스터 색' 되돌리기 대신 다른 색을 고르면 돼요.)

-- ============ 1) 공연 색 자동 배정 ============
-- 팔레트: 버건디 디자인과 어울리는 차분한 색 11가지(형광색 없음). 앱의 lib/color.ts AUTO_SHOW_COLORS와 같은 값이에요.
create or replace function public.pick_show_color() returns text
language sql stable set search_path = '' as $$
  select p.c
    from unnest(array['#b4505f','#4f78a8','#4c8a6c','#b98433','#7658a6','#3a8c96','#b8552f','#7b8a3a','#9c5589','#8a6a4f','#6b7d8c'])
         with ordinality as p(c, ord)
    left join public.shows s on lower(s.schedule_color) = p.c
   group by p.c, p.ord
   order by count(s.id), p.ord
   limit 1
$$;

create or replace function public.shows_auto_color() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.schedule_color is null then
    new.schedule_color := public.pick_show_color();
  end if;
  return new;
end $$;

drop trigger if exists shows_auto_color on public.shows;
create trigger shows_auto_color before insert or update of schedule_color on public.shows
  for each row execute function public.shows_auto_color();

-- 지금 있는 공연 중 색이 비어 있는 공연에만 한 번 채워요(만든 순서대로).
do $$
declare r record;
begin
  for r in select id from public.shows where schedule_color is null order by created_at, id loop
    update public.shows set schedule_color = public.pick_show_color() where id = r.id and schedule_color is null;
  end loop;
end $$;

-- ============ 2) 이벤트 일괄 등록 ============
alter table public.schedule_imports add column if not exists new_events integer not null default 0;
alter table public.schedule_imports add column if not exists existing_events integer not null default 0;

-- 예전(8개 인자) 함수는 새 함수(9개 인자, 마지막 p_events는 기본값 있음)로 대체돼요. 예전 화면에서 8개 인자로 불러도 그대로 동작해요.
drop function if exists public.import_schedule(text, text, integer, integer, jsonb, boolean, text, jsonb);

-- p_shows: [{ key?, title, mode: 'existing'|'new', show_id?, force_new?, venue, start, end, genre, link?, sessions: [...] }]   (key = 공백 제거·소문자 공연명)
-- p_events: [{ show_key?, show_id?, title, start, end }]
--   이벤트가 붙을 공연: 이번 등록에서 처리한 공연(show_key가 같은 p_shows 항목)을 먼저 쓰고, 없으면 show_id를 써요. 둘 다 없으면 오류(전부 되돌려져요).
create or replace function public.import_schedule(
  p_file_name text, p_file_hash text, p_total_rows integer, p_error_rows integer, p_skipped jsonb,
  p_update_cast boolean, p_link_event_title text, p_shows jsonb, p_events jsonb default '[]'::jsonb
) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  sh jsonb; se jsonb; ce jsonb; ev jsonb;
  v_show uuid; v_new boolean; v_sid uuid; v_role uuid; v_cm uuid; v_cur uuid; v_inserted boolean;
  v_key text; v_rname text; v_aname text; v_map jsonb := '{}'::jsonb;
  n_new_shows integer := 0; n_old_shows integer := 0; n_new_sessions integer := 0; n_old_sessions integer := 0;
  n_updated integer := 0; n_roles integer := 0; n_actors integer := 0; n_links integer := 0; n_sessions_total integer := 0;
  n_new_events integer := 0; n_old_events integer := 0;
  v_link text; v_start date; v_end date; v_log uuid; v_has_events boolean := to_regclass('public.events') is not null;
  v_etitle text; v_es date; v_ee date;
begin
  if not (select public.is_admin()) then raise exception 'permission denied: admin only'; end if;
  if jsonb_typeof(p_shows) is distinct from 'array' then raise exception 'p_shows must be a json array'; end if;
  if jsonb_typeof(coalesce(p_events, '[]'::jsonb)) is distinct from 'array' then raise exception 'p_events must be a json array'; end if;
  if jsonb_array_length(coalesce(p_events, '[]'::jsonb)) > 2000 then raise exception 'too many events (max 2000)'; end if;

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
        -- schedule_color를 비워 두면 shows_auto_color 트리거가 팔레트 색을 채워요.
        insert into public.shows (title, genre, start_date, end_date, venue)
        values (btrim(sh ->> 'title'), coalesce(nullif(sh ->> 'genre', ''), '뮤지컬'), nullif(sh ->> 'start', '')::date, nullif(sh ->> 'end', '')::date, coalesce(sh ->> 'venue', ''))
        returning id into v_show;
        v_new := true;
      end if;
    end if;
    if v_new then n_new_shows := n_new_shows + 1; else n_old_shows := n_old_shows + 1; end if;
    if nullif(sh ->> 'key', '') is not null then v_map := v_map || jsonb_build_object(sh ->> 'key', v_show::text); end if;

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

  -- 이벤트: 한 행 = 이벤트 하나. 같은 공연·같은 이름·같은 기간이 이미 있으면 건너뛰고, 그 밖에는 모두 새로 만들어요(기존 이벤트는 바꾸지 않아요).
  for ev in select * from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) loop
    if not v_has_events then raise exception 'events table not found (run 0004 first)'; end if;
    v_show := null;
    if nullif(ev ->> 'show_key', '') is not null and v_map ? (ev ->> 'show_key') then v_show := (v_map ->> (ev ->> 'show_key'))::uuid;
    elsif nullif(ev ->> 'show_id', '') is not null then v_show := (ev ->> 'show_id')::uuid; end if;
    if v_show is null or not exists (select 1 from public.shows where id = v_show) then
      raise exception 'event show not found: %', coalesce(ev ->> 'title', '');
    end if;
    v_etitle := btrim(coalesce(ev ->> 'title', '')); v_es := nullif(ev ->> 'start', '')::date; v_ee := nullif(ev ->> 'end', '')::date;
    if v_etitle = '' or char_length(v_etitle) > 100 then raise exception 'invalid event title'; end if;
    if v_es is null or v_ee is null or v_es > v_ee then raise exception 'invalid event period: %', v_etitle; end if;
    if exists (select 1 from public.events
                where show_id = v_show and starts_on = v_es and ends_on = v_ee
                  and regexp_replace(lower(title), '\s', '', 'g') = regexp_replace(lower(v_etitle), '\s', '', 'g')) then
      n_old_events := n_old_events + 1;
    else
      insert into public.events (title, starts_on, ends_on, show_id) values (v_etitle, v_es, v_ee, v_show);
      n_new_events := n_new_events + 1;
    end if;
  end loop;

  insert into public.schedule_imports (file_name, file_hash, total_rows, error_rows, new_shows, existing_shows, new_sessions, existing_sessions,
                                       updated_casts, new_roles, new_actors, link_events, update_cast, skipped, new_events, existing_events)
  values (left(coalesce(p_file_name, ''), 200), left(coalesce(p_file_hash, ''), 80), coalesce(p_total_rows, 0), coalesce(p_error_rows, 0),
          n_new_shows, n_old_shows, n_new_sessions, n_old_sessions, n_updated, n_roles, n_actors, n_links, coalesce(p_update_cast, false),
          coalesce((select jsonb_agg(x) from (select x from jsonb_array_elements(coalesce(p_skipped, '[]'::jsonb)) x limit 300) q), '[]'::jsonb),
          n_new_events, n_old_events)
  returning id into v_log;

  return jsonb_build_object('log_id', v_log, 'new_shows', n_new_shows, 'existing_shows', n_old_shows, 'new_sessions', n_new_sessions,
    'existing_sessions', n_old_sessions, 'updated_casts', n_updated, 'new_roles', n_roles, 'new_actors', n_actors, 'link_events', n_links,
    'new_events', n_new_events, 'existing_events', n_old_events);
end $$;

revoke execute on function public.import_schedule(text, text, integer, integer, jsonb, boolean, text, jsonb, jsonb) from public, anon;
grant execute on function public.import_schedule(text, text, integer, integer, jsonb, boolean, text, jsonb, jsonb) to authenticated;
