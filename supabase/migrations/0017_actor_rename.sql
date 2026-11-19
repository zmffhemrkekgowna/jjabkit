-- 0017: 배우 이름 일괄 변경 (변경 이력 표 1개 + 함수 2개)
-- 0001~0016을 먼저 실행한 뒤 SQL Editor에서 실행하세요. 여러 번 실행해도 안전해요(create or replace / if not exists).
-- 기존 표(공연·배역·배우·회차·캐스팅)의 구조는 바꾸지 않아요.
--
-- 이 앱에서 '배우'는 배역마다 한 줄(cast_members)이고, 회차 캐스팅(session_cast)은 그 줄의 id로 연결돼요.
-- 그래서 이름을 바꿔도 id와 회차 연결은 그대로 유지돼요.
--   - 같은 배역에 이미 새 이름의 배우가 있으면 중복이 생기지 않게 그 배우로 합쳐요(회차 연결을 옮기고 옛 줄을 지워요). 되돌리면 다시 나눠요.
--   - 관심 배우는 각자의 브라우저에 '이름'으로 저장돼 있어서, 이 이력(actor_renames)을 보고 다음 접속 때 새 이름으로 이어져요.
--
-- 되돌리기(필요하면):
--   drop function if exists public.rename_actor(text, text);
--   drop function if exists public.undo_actor_rename(uuid);
--   drop table if exists public.actor_renames;

create table if not exists public.actor_renames (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  old_name text not null,
  new_name text not null,
  renamed_ids uuid[] not null default '{}',   -- 이름만 바뀐 배우 줄 id
  merges jsonb not null default '[]'::jsonb,  -- 합쳐진 줄: [{role_id, from_id, from_sort, into_id, session_ids:[...]}]
  member_count integer not null default 0,
  show_count integer not null default 0,
  session_count integer not null default 0,
  undone_at timestamptz,
  undone_by uuid
);
create index if not exists actor_renames_created_idx on public.actor_renames (created_at desc);

alter table public.actor_renames enable row level security;
drop policy if exists "read all" on public.actor_renames;
create policy "read all" on public.actor_renames for select to anon, authenticated using (true);
drop policy if exists "admin insert" on public.actor_renames;
create policy "admin insert" on public.actor_renames for insert to authenticated with check ((select public.is_admin()));
drop policy if exists "admin update" on public.actor_renames;
create policy "admin update" on public.actor_renames for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
revoke all on public.actor_renames from anon, authenticated;
-- 손님(브라우저)은 관심 배우 이어붙이기에 필요한 열만 읽어요.
grant select (id, created_at, old_name, new_name, undone_at) on public.actor_renames to anon;
grant select, insert, update on public.actor_renames to authenticated;

create or replace function public.rename_actor(p_old text, p_new text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  v_old text := btrim(coalesce(p_old, '')); v_new text := btrim(coalesce(p_new, ''));
  m record; e uuid; v_sess uuid[]; v_renamed uuid[] := '{}'; v_merges jsonb := '[]'::jsonb;
  n_ren integer := 0; n_mer integer := 0; n_shows integer; n_sessions integer; v_log uuid;
begin
  if not (select public.is_admin()) then raise exception '관리자만 사용할 수 있어요.' using errcode = '42501'; end if;
  if v_old = '' or v_new = '' then raise exception '기존 이름과 새 이름을 모두 입력해 주세요.'; end if;
  if char_length(v_new) > 50 then raise exception '새 이름이 너무 길어요(50자 이하).'; end if;
  if v_old = v_new then raise exception '기존 이름과 새 이름이 같아요.'; end if;
  if not exists (select 1 from public.cast_members where name = v_old) then raise exception '‘%’ 이름의 배우를 찾지 못했어요.', v_old; end if;

  -- 영향 범위(변경 전에 계산): 공연 수·회차 수
  select count(distinct r.show_id) into n_shows from public.cast_members c join public.roles r on r.id = c.role_id where c.name = v_old;
  select count(*) into n_sessions from public.session_cast sc join public.cast_members c on c.id = sc.cast_member_id where c.name = v_old;

  for m in select c.id, c.role_id, c.sort_order from public.cast_members c where c.name = v_old order by c.role_id, c.sort_order, c.id loop
    select id into e from public.cast_members where role_id = m.role_id and name = v_new and id <> m.id order by sort_order, id limit 1;
    if e is null then
      update public.cast_members set name = v_new where id = m.id;
      v_renamed := v_renamed || m.id; n_ren := n_ren + 1;
    else
      select coalesce(array_agg(session_id), '{}') into v_sess from public.session_cast where cast_member_id = m.id and role_id = m.role_id;
      update public.session_cast set cast_member_id = e where cast_member_id = m.id and role_id = m.role_id;
      delete from public.cast_members where id = m.id;
      v_merges := v_merges || jsonb_build_object('role_id', m.role_id, 'from_id', m.id, 'from_sort', m.sort_order, 'into_id', e, 'session_ids', to_jsonb(v_sess));
      n_mer := n_mer + 1;
    end if;
  end loop;

  insert into public.actor_renames (old_name, new_name, renamed_ids, merges, member_count, show_count, session_count)
  values (v_old, v_new, v_renamed, v_merges, n_ren + n_mer, n_shows, n_sessions) returning id into v_log;
  return jsonb_build_object('log_id', v_log, 'renamed', n_ren, 'merged', n_mer, 'shows', n_shows, 'sessions', n_sessions);
end $$;

create or replace function public.undo_actor_rename(p_id uuid) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  l public.actor_renames%rowtype; mg jsonb; n_back integer := 0; n_split integer := 0; n_skip integer := 0; n integer; v_sid uuid;
begin
  if not (select public.is_admin()) then raise exception '관리자만 사용할 수 있어요.' using errcode = '42501'; end if;
  select * into l from public.actor_renames where id = p_id for update;
  if not found then raise exception '변경 이력을 찾지 못했어요.'; end if;
  if l.undone_at is not null then raise exception '이미 되돌린 변경이에요.'; end if;

  -- 이름만 바뀐 줄: 아직 새 이름일 때만 옛 이름으로 돌려요(그 사이 다른 이름으로 바뀐 줄은 건드리지 않아요).
  update public.cast_members set name = l.old_name where id = any(l.renamed_ids) and name = l.new_name;
  get diagnostics n_back = row_count;
  n_skip := coalesce(array_length(l.renamed_ids, 1), 0) - n_back;

  -- 합쳐진 줄: 같은 id로 다시 만들고, 그때 옮겼던 회차만 되돌려요.
  for mg in select * from jsonb_array_elements(l.merges) loop
    if exists (select 1 from public.roles where id = (mg ->> 'role_id')::uuid)
       and exists (select 1 from public.cast_members where id = (mg ->> 'into_id')::uuid)
       and not exists (select 1 from public.cast_members where id = (mg ->> 'from_id')::uuid) then
      insert into public.cast_members (id, role_id, name, sort_order)
      values ((mg ->> 'from_id')::uuid, (mg ->> 'role_id')::uuid, l.old_name, (mg ->> 'from_sort')::int);
      for v_sid in select (x)::uuid from jsonb_array_elements_text(mg -> 'session_ids') x loop
        update public.session_cast set cast_member_id = (mg ->> 'from_id')::uuid
         where session_id = v_sid and role_id = (mg ->> 'role_id')::uuid and cast_member_id = (mg ->> 'into_id')::uuid;
      end loop;
      n_split := n_split + 1;
    else
      n_skip := n_skip + 1;
    end if;
  end loop;

  update public.actor_renames set undone_at = now(), undone_by = auth.uid() where id = p_id;
  return jsonb_build_object('restored', n_back, 'split', n_split, 'skipped', n_skip);
end $$;

revoke execute on function public.rename_actor(text, text) from public, anon;
grant execute on function public.rename_actor(text, text) to authenticated;
revoke execute on function public.undo_actor_rename(uuid) from public, anon;
grant execute on function public.undo_actor_rename(uuid) to authenticated;
