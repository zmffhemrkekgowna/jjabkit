-- 0009: 공연별 스케줄 색 (shows.schedule_color)
-- 0001~0008을 먼저 실행한 뒤 SQL Editor에서 한 번 실행하세요. 여러 번 실행해도 안전해요.
-- 기존 공연과 데이터는 바꾸지 않아요. 비워 두면(null) 앱이 포스터 색을 대신 써요. '#rrggbb' 형식만 받아요.
-- 색은 공연에 한 번만 저장하고, 회차마다 따로 저장하지 않아요.

alter table public.shows add column if not exists schedule_color text;
alter table public.shows drop constraint if exists shows_schedule_color_check;
alter table public.shows add constraint shows_schedule_color_check check (schedule_color is null or schedule_color ~ '^#[0-9a-fA-F]{6}$');

-- 백업 불러오기(import_shows)가 스케줄 색(color)도 함께 복원하도록 같은 함수를 다시 정의해요.
-- 0003의 함수와 달라진 곳은 shows 입력에 schedule_color 한 칸이 늘어난 것뿐이에요. 권한(grant)은 그대로 유지돼요.
create or replace function public.import_shows(p_data jsonb, p_replace boolean default false)
returns integer
language plpgsql security invoker set search_path = '' as $$
declare
  s jsonb; r jsonb; ss jsonb; c record;
  v_show uuid; v_role uuid; v_sess uuid; v_mem uuid;
  actor text; n integer := 0; sort_i integer; sort_j integer;
begin
  if not (select public.is_admin()) then
    raise exception 'permission denied: admin only';
  end if;
  if jsonb_typeof(p_data -> 'shows') is distinct from 'array' then
    raise exception 'invalid backup: shows must be an array';
  end if;
  if jsonb_array_length(p_data -> 'shows') > 200 then
    raise exception 'invalid backup: too many shows';
  end if;

  if p_replace then
    delete from public.shows where true;
  end if;

  for s in select * from jsonb_array_elements(p_data -> 'shows') loop
    insert into public.shows (title, genre, status, start_date, end_date, venue, region,
                              age_rating, runtime_text, early_bird_text, poster_url, poster_palette, schedule_color)
    values (
      s ->> 'title',
      coalesce(s ->> 'genre', '뮤지컬'),
      coalesce(s ->> 'status', 'upcoming'),
      nullif(s ->> 'start', '')::date,
      nullif(s ->> 'end', '')::date,
      coalesce(s ->> 'venue', ''), coalesce(s ->> 'region', '서울'),
      coalesce(s ->> 'age', ''), coalesce(s ->> 'run', ''), coalesce(s ->> 'eb', ''),
      nullif(s ->> 'img', ''),
      coalesce(nullif(s ->> 'grad', ''), '#1c2b4a,#3b1d4f,#8B1E3F'),
      case when (s ->> 'color') ~ '^#[0-9a-fA-F]{6}$' then s ->> 'color' else null end
    ) returning id into v_show;

    sort_i := 0;
    for r in select * from jsonb_array_elements(coalesce(s -> 'roles', '[]'::jsonb)) loop
      insert into public.roles (show_id, name, short_name, sort_order)
      values (v_show, r ->> 'name', coalesce(r ->> 'short', r ->> 'name'), sort_i)
      returning id into v_role;
      sort_i := sort_i + 1;
      sort_j := 0;
      for actor in select jsonb_array_elements_text(coalesce(r -> 'actors', '[]'::jsonb)) loop
        insert into public.cast_members (role_id, name, sort_order) values (v_role, actor, sort_j);
        sort_j := sort_j + 1;
      end loop;
    end loop;

    for ss in select * from jsonb_array_elements(coalesce(s -> 'sessions', '[]'::jsonb)) loop
      insert into public.sessions (show_id, starts_on, starts_at, is_curtain_call, is_time_sale)
      values (v_show, (ss ->> 'date')::date, (ss ->> 'time')::time,
              coalesce((ss ->> 'curtain')::boolean, false), coalesce((ss ->> 'timesale')::boolean, false))
      returning id into v_sess;

      for c in select key, value from jsonb_each_text(coalesce(ss -> 'cast', '{}'::jsonb)) loop
        select id into v_role from public.roles where show_id = v_show and name = c.key;
        if v_role is null then
          raise exception 'invalid backup: unknown role "%" in show "%"', c.key, s ->> 'title';
        end if;
        v_mem := null;
        if c.value <> '' then
          select id into v_mem from public.cast_members where role_id = v_role and name = c.value;
          if v_mem is null then
            raise exception 'invalid backup: unknown actor "%" for role "%"', c.value, c.key;
          end if;
        end if;
        insert into public.session_cast (session_id, role_id, cast_member_id) values (v_sess, v_role, v_mem);
      end loop;
    end loop;
    n := n + 1;
  end loop;
  return n;
end $$;
