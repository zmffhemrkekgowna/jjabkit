-- 0003: 소식/공지 표(notices)와 백업 불러오기 함수(import_shows)
-- 0001_init.sql을 먼저 실행한 뒤 이 파일을 SQL Editor에서 한 번 실행하세요. 여러 번 실행해도 안전해요.
--
-- 권한 구조는 다른 표와 같아요: 읽기는 누구나, 추가·수정·삭제는 관리자(public.admins 등록 계정)만.

create table if not exists public.notices (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'notice' check (kind in ('new_show', 'schedule', 'update', 'notice')),
  title text not null check (char_length(title) between 1 and 100),
  body text not null default '' check (char_length(body) <= 2000),
  show_id uuid references public.shows (id) on delete set null,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notices_order_idx on public.notices (pinned desc, created_at desc);

drop trigger if exists notices_touch on public.notices;
create trigger notices_touch before update on public.notices
for each row execute function public.touch_updated_at();

alter table public.notices enable row level security;
drop policy if exists "public read" on public.notices;
drop policy if exists "admin insert" on public.notices;
drop policy if exists "admin update" on public.notices;
drop policy if exists "admin delete" on public.notices;
create policy "public read" on public.notices for select to anon, authenticated using (true);
create policy "admin insert" on public.notices for insert to authenticated with check ((select public.is_admin()));
create policy "admin update" on public.notices for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "admin delete" on public.notices for delete to authenticated using ((select public.is_admin()));

revoke all on public.notices from anon, authenticated;
grant select on public.notices to anon, authenticated;
grant insert, update, delete on public.notices to authenticated;

-- ---------------------------------------------------------------------------
-- 백업 불러오기: JSON 한 덩어리를 한 번에(전부 성공하거나 전부 취소) 넣어요.
--   p_data    : {"shows":[{title, genre, status, start, end, venue, region, age, run, eb, grad, img,
--                          roles:[{name, short, actors:[이름...]}],
--                          sessions:[{date, time, curtain, timesale, cast:{배역이름: 배우이름 또는 ""}}]}]}
--   p_replace : true면 기존 공연을 모두 지운 뒤 넣어요(복구). false면 기존 공연은 그대로 두고 추가해요.
-- security invoker라서 RLS가 그대로 적용되고, 관리자가 아니면 시작하자마자 오류를 내요.
-- ---------------------------------------------------------------------------
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
                              age_rating, runtime_text, early_bird_text, poster_url, poster_palette)
    values (
      s ->> 'title',
      coalesce(s ->> 'genre', '뮤지컬'),
      coalesce(s ->> 'status', 'upcoming'),
      nullif(s ->> 'start', '')::date,
      nullif(s ->> 'end', '')::date,
      coalesce(s ->> 'venue', ''), coalesce(s ->> 'region', '서울'),
      coalesce(s ->> 'age', ''), coalesce(s ->> 'run', ''), coalesce(s ->> 'eb', ''),
      nullif(s ->> 'img', ''),
      coalesce(nullif(s ->> 'grad', ''), '#1c2b4a,#3b1d4f,#8B1E3F')
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

revoke execute on function public.import_shows(jsonb, boolean) from public, anon;
grant execute on function public.import_shows(jsonb, boolean) to authenticated;
