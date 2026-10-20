-- 권한 점검 스크립트 (Supabase SQL Editor에서 통째로 실행하세요)
--
-- 하는 일: 점검용 공연을 만들고, "로그인 안 한 방문자 / 로그인했지만 관리자가 아닌 계정 / 관리자"로 역할을 바꿔 가며
--          읽기·쓰기가 의도대로 허용·차단되는지 확인해요.
-- 안전장치: 마지막에 일부러 오류를 내서 모든 변경을 되돌려요. 그래서 이 스크립트를 실행한 뒤에는
--          결과가 "ERROR: RLS 점검 결과 ..." 형태로 나오는 것이 정상이고, 데이터는 하나도 남지 않아요.
-- 참고: 관리자 점검은 public.admins에 등록된 계정 중 한 명의 id를 빌려 쓰므로, 관리자를 먼저 등록해 두세요.

do $check$
declare
  res text := E'RLS 점검 결과\n';
  admin_id uuid;
  v_show uuid; v_r1 uuid; v_r2 uuid; v_m1 uuid; v_m2 uuid;
  sess_sql text;
begin
  create schema rls_check;
  grant usage on schema rls_check to public;
  create function rls_check.try(q text) returns boolean language plpgsql as $f$
  begin execute q; return true; exception when others then return false; end $f$;
  create function rls_check.n(q text) returns int language plpgsql as $f$
  declare c int; begin execute q; get diagnostics c = row_count; return c; exception when others then return -1; end $f$;
  create function rls_check.line(ok boolean, label text) returns text language sql as $f$
    select case when ok then 'PASS  ' else 'FAIL  ' end || label || E'\n' $f$;
  grant execute on all functions in schema rls_check to public;

  -- 점검용 데이터 (현재 역할은 대시보드의 관리 권한이라 RLS와 무관하게 만들 수 있어요)
  insert into public.shows (title) values ('RLS 점검용') returning id into v_show;
  insert into public.roles (show_id, name, short_name) values (v_show, 'A', 'A') returning id into v_r1;
  insert into public.roles (show_id, name, short_name) values (v_show, 'B', 'B') returning id into v_r2;
  insert into public.cast_members (role_id, name) values (v_r1, '가') returning id into v_m1;
  insert into public.cast_members (role_id, name) values (v_r2, '나') returning id into v_m2;

  -- 1) 로그인하지 않은 일반 방문자 (anon)
  set local role anon;
  res := res || rls_check.line(rls_check.n('select 1 from public.shows') >= 1, '방문자: 공연 읽기 가능');
  res := res || rls_check.line(rls_check.n('select 1 from public.sessions') >= 0, '방문자: 회차 읽기 가능');
  res := res || rls_check.line(not rls_check.try('insert into public.shows (title) values (''x'')'), '방문자: 공연 추가 차단');
  res := res || rls_check.line(rls_check.n('update public.shows set title = ''hack''') <= 0, '방문자: 공연 수정 차단(0건)');
  res := res || rls_check.line(rls_check.n('delete from public.shows') <= 0, '방문자: 공연 삭제 차단(0건)');
  res := res || rls_check.line(not rls_check.try('select 1 from public.admins'), '방문자: admins 표 읽기 차단');
  res := res || rls_check.line(not rls_check.try('select public.is_admin()'), '방문자: is_admin() 호출 차단');
  res := res || rls_check.line(not rls_check.try(format('select public.save_session(null, %L, ''2099-01-01'', ''19:00'', false, false, ''{}''::jsonb)', v_show)), '방문자: 회차 저장 함수 차단');
  res := res || rls_check.line(to_regclass('public.notices') is null or rls_check.n('select 1 from public.notices') >= 0, '방문자: 소식 읽기 가능 (0003 적용 시)');
  if to_regclass('public.notices') is not null then
    res := res || rls_check.line(not rls_check.try('insert into public.notices (title) values (''x'')'), '방문자: 소식 추가 차단');
    res := res || rls_check.line(not rls_check.try('select public.import_shows(''{"shows":[]}''::jsonb, false)'), '방문자: 백업 불러오기 함수 차단');
  end if;
  reset role;

  -- 2) 로그인했지만 관리자가 아닌 계정
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  perform set_config('request.jwt.claims', json_build_object('sub', current_setting('request.jwt.claim.sub'), 'role', 'authenticated')::text, true);
  set local role authenticated;
  res := res || rls_check.line(rls_check.n('select 1 from public.shows') >= 1, '일반 계정: 공연 읽기 가능');
  res := res || rls_check.line(not rls_check.try('insert into public.shows (title) values (''x'')'), '일반 계정: 공연 추가 차단');
  res := res || rls_check.line(rls_check.n('update public.shows set title = ''hack''') <= 0, '일반 계정: 공연 수정 차단(0건)');
  res := res || rls_check.line(rls_check.n('delete from public.sessions') <= 0, '일반 계정: 회차 삭제 차단(0건)');
  res := res || rls_check.line(not rls_check.try('select 1 from public.admins'), '일반 계정: admins 표 읽기 차단');
  res := res || rls_check.line(not rls_check.try(format('select public.save_session(null, %L, ''2099-01-01'', ''19:00'', false, false, ''{}''::jsonb)', v_show)), '일반 계정: 회차 저장 함수 차단');
  res := res || rls_check.line(not rls_check.try('insert into storage.objects (bucket_id, name) values (''posters'', ''x.png'')'), '일반 계정: 포스터 업로드 차단');
  if to_regclass('public.notices') is not null then
    res := res || rls_check.line(not rls_check.try('insert into public.notices (title) values (''x'')'), '일반 계정: 소식 추가 차단');
    res := res || rls_check.line(not rls_check.try('select public.import_shows(''{"shows":[]}''::jsonb, true)'), '일반 계정: 백업 불러오기(교체) 차단');
  end if;
  reset role;

  -- 3) 관리자
  select user_id into admin_id from public.admins limit 1;
  if admin_id is null then
    res := res || E'SKIP  관리자 점검: public.admins에 등록된 관리자가 없어 건너뛰었어요\n';
  else
    perform set_config('request.jwt.claim.sub', admin_id::text, true);
    perform set_config('request.jwt.claims', json_build_object('sub', admin_id::text, 'role', 'authenticated')::text, true);
    set local role authenticated;
    res := res || rls_check.line(rls_check.n('select 1 where public.is_admin()') = 1, '관리자: is_admin()이 true');
    res := res || rls_check.line(rls_check.try('insert into public.shows (title) values (''RLS 관리자 추가'')'), '관리자: 공연 추가 가능');
    res := res || rls_check.line(rls_check.n(format('update public.shows set venue = ''바뀐 극장'' where id = %L', v_show)) = 1, '관리자: 공연 수정 가능');
    sess_sql := format('select public.save_session(null, %L, ''2099-01-01'', ''19:00'', false, false, %L::jsonb)', v_show, jsonb_build_object(v_r1::text, v_m1::text));
    res := res || rls_check.line(rls_check.try(sess_sql), '관리자: 회차 저장 가능');
    res := res || rls_check.line(not rls_check.try(sess_sql), '관리자: 같은 날짜·시간 회차는 중복 차단');
    res := res || rls_check.line(not rls_check.try(format('select public.save_session(null, %L, ''2099-01-02'', ''19:00'', false, false, %L::jsonb)', v_show, jsonb_build_object(v_r1::text, v_m2::text))), '관리자: 다른 배역의 배우 지정 차단');
    res := res || rls_check.line(rls_check.try(format('delete from public.cast_members where id = %L', v_m1)), '관리자: 배우 삭제 가능');
    res := res || rls_check.line(rls_check.n(format('select 1 from public.session_cast where role_id = %L and cast_member_id is null', v_r1)) = 1, '관리자: 삭제한 배우의 회차는 미정으로 바뀜');
    if to_regclass('public.notices') is not null then
      res := res || rls_check.line(rls_check.try('insert into public.notices (title) values (''RLS 점검 소식'')'), '관리자: 소식 추가 가능');
      res := res || rls_check.line(rls_check.try('select public.import_shows(''{"shows":[{"title":"RLS 가져오기"}]}''::jsonb, false)'), '관리자: 백업 불러오기(추가) 가능');
      res := res || rls_check.line(not rls_check.try('select public.import_shows(''{"shows":[{"title":"t","sessions":[{"date":"2099-01-01","time":"10:00","cast":{"없는배역":""}}]}]}''::jsonb, false)'), '관리자: 잘못된 백업은 오류');
    end if;
    res := res || rls_check.line(rls_check.try(format('delete from public.shows where id = %L', v_show)), '관리자: 공연 삭제 가능');
    res := res || rls_check.line(rls_check.n(format('select 1 from public.sessions where show_id = %L', v_show)) = 0, '관리자: 공연 삭제 시 회차도 함께 삭제');
    reset role;
  end if;

  -- 일부러 오류를 내서 위의 모든 변경(점검용 데이터, 임시 함수)을 되돌려요.
  raise exception '%', res;
end $check$;
