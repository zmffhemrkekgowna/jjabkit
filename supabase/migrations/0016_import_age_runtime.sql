-- 0016: 엑셀 붙여넣기에 관람등급·러닝타임 추가
--   * 새 열은 만들지 않아요. 이미 있는 shows.age_rating / shows.runtime_text 에 저장해요.
--   * import_schedule 함수만 바꿔요(인자 모양은 그대로라 예전 화면에서 불러도 동작해요). 0015가 먼저 적용돼 있어야 해요.
--   * 새 공연: 엑셀 값(p_shows[].age / run)을 그대로 저장. 이미 있는 공연: 비어 있는 칸만 채우고 기존 값은 유지.
--   * 되돌리기: 0015의 import_schedule 정의를 다시 실행하면 돼요(저장된 값은 그대로 남아요).
-- 여러 번 실행해도 안전해요(create or replace).

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
        insert into public.shows (title, genre, start_date, end_date, venue, age_rating, runtime_text)
        values (btrim(sh ->> 'title'), coalesce(nullif(sh ->> 'genre', ''), '뮤지컬'), nullif(sh ->> 'start', '')::date, nullif(sh ->> 'end', '')::date, coalesce(sh ->> 'venue', ''),
                coalesce(btrim(sh ->> 'age'), ''), coalesce(btrim(sh ->> 'run'), ''))
        returning id into v_show;
        v_new := true;
      end if;
    end if;
    if v_new then n_new_shows := n_new_shows + 1; else n_old_shows := n_old_shows + 1; end if;
    -- 이미 있던 공연은 관람등급·러닝타임이 '비어 있을 때만' 채워요. 이미 적힌 값은 절대 바꾸지 않고, 엑셀 칸이 비어 있어도 아무것도 지우지 않아요.
    if not v_new and (nullif(btrim(sh ->> 'age'), '') is not null or nullif(btrim(sh ->> 'run'), '') is not null) then
      update public.shows set
        age_rating   = case when btrim(age_rating) = ''   then coalesce(nullif(btrim(sh ->> 'age'), ''), age_rating)   else age_rating end,
        runtime_text = case when btrim(runtime_text) = '' then coalesce(nullif(btrim(sh ->> 'run'), ''), runtime_text) else runtime_text end
       where id = v_show
         and ((btrim(age_rating) = '' and nullif(btrim(sh ->> 'age'), '') is not null)
           or (btrim(runtime_text) = '' and nullif(btrim(sh ->> 'run'), '') is not null));
    end if;
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
