-- 0008: 관리자 작업의 원자성(전부 되거나 전부 안 되거나) + 회차 캐스팅의 공연 소속 검증
-- 0001~0007을 먼저 실행한 뒤 SQL Editor에서 실행하세요. 여러 번 실행해도 안전해요(create or replace / drop trigger if exists).
-- 기존 표와 데이터는 바꾸지 않아요. 함수 4개와 트리거 1개만 추가해요.
--
-- 되돌리기(필요하면):
--   drop function if exists public.delete_sessions(uuid, uuid[]);
--   drop function if exists public.bulk_update_sessions(uuid, jsonb);
--   drop function if exists public.restore_sessions(uuid, jsonb);
--   drop function if exists public.delete_show_bundle(uuid);
--   drop function if exists public.restore_show_bundle(jsonb);
--   drop trigger if exists session_cast_same_show on public.session_cast; drop function if exists public.check_session_cast_show();
--
-- 모든 함수는 security invoker 입니다. 즉 호출한 사람의 권한으로 실행되어 기존 RLS가 그대로 적용되고,
-- 함수 안에서도 public.is_admin()을 한 번 더 확인해요. 함수 하나는 하나의 트랜잭션이라 중간에 오류가 나면 전부 되돌려져요.

-- 1) 선택한 회차를 한꺼번에 삭제. 하나라도 이 공연의 회차가 아니거나 없으면 아무것도 지우지 않아요.
create or replace function public.delete_sessions(p_show_id uuid, p_ids uuid[]) returns integer
language plpgsql security invoker set search_path = '' as $$
declare v_want integer; v_n integer;
begin
  if not (select public.is_admin()) then raise exception 'permission denied: admin only'; end if;
  select count(distinct x) into v_want from unnest(coalesce(p_ids, '{}')) x;
  if v_want = 0 then return 0; end if;
  delete from public.sessions where show_id = p_show_id and id = any (p_ids);
  get diagnostics v_n = row_count;
  if v_n <> v_want then raise exception 'sessions not found: requested %, deleted %', v_want, v_n; end if;
  return v_n;
end $$;

-- 2) 여러 회차를 한꺼번에 수정. p_items: [{id, date, time, curtain, timesale, cast?}]. cast가 없으면 캐스팅은 그대로 둬요.
--    같은 날짜·시간 회차가 생기면(unique 위반) 전체가 롤백돼요.
create or replace function public.bulk_update_sessions(p_show_id uuid, p_items jsonb) returns integer
language plpgsql security invoker set search_path = '' as $$
declare it jsonb; v_id uuid; v_n integer := 0;
begin
  if not (select public.is_admin()) then raise exception 'permission denied: admin only'; end if;
  if jsonb_typeof(p_items) is distinct from 'array' then raise exception 'p_items must be a json array'; end if;
  for it in select * from jsonb_array_elements(p_items) loop
    update public.sessions
       set starts_on = (it ->> 'date')::date, starts_at = (it ->> 'time')::time,
           is_curtain_call = coalesce((it ->> 'curtain')::boolean, is_curtain_call),
           is_time_sale = coalesce((it ->> 'timesale')::boolean, is_time_sale)
     where id = (it ->> 'id')::uuid and show_id = p_show_id
    returning id into v_id;
    if v_id is null then raise exception 'session not found: %', it ->> 'id'; end if;
    if it ? 'cast' then
      delete from public.session_cast where session_id = v_id;
      insert into public.session_cast (session_id, role_id, cast_member_id)
      select v_id, key::uuid, nullif(value, '')::uuid from jsonb_each_text(it -> 'cast');
    end if;
    v_n := v_n + 1;
    v_id := null;
  end loop;
  return v_n;
end $$;

-- 3) 삭제했던 회차를 같은 id로 되살림(실행 취소). p_sessions: [{id, date, time, curtain, timesale, cast:{role_id: cast_member_id|""}}]
--    배우가 그새 지워졌거나 그 배역 소속이 아니면 그 배역만 '미정'으로, 배역 자체가 없어졌으면 그 줄만 빼요. 나머지 캐스팅은 그대로 복구해요.
--    돌려주는 값: {restored, uncast, dropped}
create or replace function public.restore_sessions(p_show_id uuid, p_sessions jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare s jsonb; c record; v_restored integer := 0; v_uncast integer := 0; v_dropped integer := 0; v_cm uuid;
begin
  if not (select public.is_admin()) then raise exception 'permission denied: admin only'; end if;
  if jsonb_typeof(p_sessions) is distinct from 'array' then raise exception 'p_sessions must be a json array'; end if;
  for s in select * from jsonb_array_elements(p_sessions) loop
    insert into public.sessions (id, show_id, starts_on, starts_at, is_curtain_call, is_time_sale)
    values ((s ->> 'id')::uuid, p_show_id, (s ->> 'date')::date, (s ->> 'time')::time,
            coalesce((s ->> 'curtain')::boolean, false), coalesce((s ->> 'timesale')::boolean, false));
    v_restored := v_restored + 1;
    for c in select key::uuid as role_id, nullif(value, '')::uuid as cm from jsonb_each_text(coalesce(s -> 'cast', '{}'::jsonb)) loop
      if not exists (select 1 from public.roles r where r.id = c.role_id and r.show_id = p_show_id) then v_dropped := v_dropped + 1; continue; end if;
      v_cm := c.cm;
      if v_cm is not null and not exists (select 1 from public.cast_members m where m.id = v_cm and m.role_id = c.role_id) then v_cm := null; v_uncast := v_uncast + 1; end if;
      insert into public.session_cast (session_id, role_id, cast_member_id) values ((s ->> 'id')::uuid, c.role_id, v_cm);
    end loop;
  end loop;
  return jsonb_build_object('restored', v_restored, 'uncast', v_uncast, 'dropped', v_dropped);
end $$;

-- 4) 공연과 딸린 모든 데이터(배역·배우·회차·캐스팅·이벤트)를 한 번에 지우고, 지우기 전 내용을 돌려줘요(실행 취소용).
--    이벤트 표(0004)가 없는 DB에서는 이벤트만 건너뛰어요(표 유무를 확인해서 구분하고, 다른 오류는 그대로 오류예요).
create or replace function public.delete_show_bundle(p_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v jsonb; v_events jsonb := '[]'::jsonb;
begin
  if not (select public.is_admin()) then raise exception 'permission denied: admin only'; end if;
  select jsonb_build_object('show', to_jsonb(s)) into v from public.shows s where s.id = p_id;
  if v is null then raise exception 'show not found: %', p_id; end if;
  v := v || jsonb_build_object(
    'roles', coalesce((select jsonb_agg(to_jsonb(r) order by r.sort_order) from public.roles r where r.show_id = p_id), '[]'::jsonb),
    'cast_members', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order) from public.cast_members m join public.roles r on r.id = m.role_id where r.show_id = p_id), '[]'::jsonb),
    'sessions', coalesce((select jsonb_agg(to_jsonb(x)) from public.sessions x where x.show_id = p_id), '[]'::jsonb),
    'session_cast', coalesce((select jsonb_agg(to_jsonb(c)) from public.session_cast c join public.sessions x on x.id = c.session_id where x.show_id = p_id), '[]'::jsonb));
  if to_regclass('public.events') is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(e)), ''[]''::jsonb) from public.events e where e.show_id = $1' into v_events using p_id;
    execute 'delete from public.events where show_id = $1' using p_id;
  end if;
  v := v || jsonb_build_object('events', v_events);
  delete from public.shows where id = p_id;  -- 배역·배우·회차·캐스팅은 cascade
  return v;
end $$;

-- 5) delete_show_bundle이 돌려준 내용으로 공연을 같은 id 그대로 되살려요. 돌려주는 값: {uncast, dropped}
create or replace function public.restore_show_bundle(p_bundle jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_id uuid; c record; v_cm uuid; v_uncast integer := 0; v_dropped integer := 0;
begin
  if not (select public.is_admin()) then raise exception 'permission denied: admin only'; end if;
  v_id := (p_bundle -> 'show' ->> 'id')::uuid;
  if v_id is null then raise exception 'invalid bundle: show id missing'; end if;
  insert into public.shows select * from jsonb_populate_record(null::public.shows, p_bundle -> 'show');
  insert into public.roles select * from jsonb_populate_recordset(null::public.roles, coalesce(p_bundle -> 'roles', '[]'::jsonb));
  insert into public.cast_members select * from jsonb_populate_recordset(null::public.cast_members, coalesce(p_bundle -> 'cast_members', '[]'::jsonb));
  insert into public.sessions select * from jsonb_populate_recordset(null::public.sessions, coalesce(p_bundle -> 'sessions', '[]'::jsonb));
  for c in select * from jsonb_populate_recordset(null::public.session_cast, coalesce(p_bundle -> 'session_cast', '[]'::jsonb)) loop
    if not exists (select 1 from public.roles r where r.id = c.role_id and r.show_id = v_id)
       or not exists (select 1 from public.sessions x where x.id = c.session_id and x.show_id = v_id) then v_dropped := v_dropped + 1; continue; end if;
    v_cm := c.cast_member_id;
    if v_cm is not null and not exists (select 1 from public.cast_members m where m.id = v_cm and m.role_id = c.role_id) then v_cm := null; v_uncast := v_uncast + 1; end if;
    insert into public.session_cast (session_id, role_id, cast_member_id) values (c.session_id, c.role_id, v_cm);
  end loop;
  if jsonb_array_length(coalesce(p_bundle -> 'events', '[]'::jsonb)) > 0 then
    if to_regclass('public.events') is null then raise exception 'events table missing (run 0004)'; end if;
    execute 'insert into public.events select * from jsonb_populate_recordset(null::public.events, $1)' using p_bundle -> 'events';
  end if;
  return jsonb_build_object('uncast', v_uncast, 'dropped', v_dropped);
end $$;

-- 6) 회차와 배역은 같은 공연에 속해야 해요. (복합 FK는 배우↔배역만 보장했어요)
create or replace function public.check_session_cast_show() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if not exists (select 1 from public.sessions s join public.roles r on r.show_id = s.show_id where s.id = new.session_id and r.id = new.role_id) then
    raise exception 'role belongs to a different show than the session' using errcode = '23514';
  end if;
  return new;
end $$;
drop trigger if exists session_cast_same_show on public.session_cast;
create trigger session_cast_same_show before insert or update of session_id, role_id on public.session_cast
for each row execute function public.check_session_cast_show();

-- 기존 데이터 점검(트리거는 앞으로의 입력만 막아요). 아래 숫자가 0이 아니면 해당 행을 확인해 주세요.
do $$
declare n integer;
begin
  select count(*) into n from public.session_cast c join public.sessions s on s.id = c.session_id join public.roles r on r.id = c.role_id where r.show_id <> s.show_id;
  raise notice '0008 점검: 다른 공연의 배역에 연결된 기존 캐스팅 행 = %', n;
end $$;

revoke execute on function public.delete_sessions(uuid, uuid[]), public.bulk_update_sessions(uuid, jsonb), public.restore_sessions(uuid, jsonb),
  public.delete_show_bundle(uuid), public.restore_show_bundle(jsonb) from public, anon;
grant execute on function public.delete_sessions(uuid, uuid[]), public.bulk_update_sessions(uuid, jsonb), public.restore_sessions(uuid, jsonb),
  public.delete_show_bundle(uuid), public.restore_show_bundle(jsonb) to authenticated;
