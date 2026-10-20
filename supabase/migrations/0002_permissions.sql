-- 권한 정리 패치: 새 프로젝트는 0001_init.sql 하나로 충분해요. (같은 내용이 0001 끝에 들어 있어요)
-- 이미 예전 버전의 0001만 실행해 둔 프로젝트에서 이 파일을 한 번 실행하세요. 여러 번 실행해도 안전해요.
--
-- 구조
--   공개(anon, 로그인 안 한 방문자)     : shows / roles / cast_members / sessions / session_cast 읽기만
--   로그인했지만 관리자가 아닌 계정      : 위와 같음 (읽기만)
--   관리자(public.admins에 등록된 계정) : 위 5개 표 쓰기(추가·수정·삭제), 포스터 업로드
--   admins 표 자체                      : 아무도 API로 읽거나 쓸 수 없어요. SQL Editor(대시보드)에서만 관리해요.

-- admins 표는 API 역할(anon, authenticated)에게 어떤 권한도 주지 않아요.
revoke all on public.admins from anon, authenticated;

-- 공개 읽기 권한이 5개 표에만 있는지 다시 지정 (쓰기는 authenticated에게만 주고, 실제 허용은 RLS의 is_admin()이 결정)
revoke insert, update, delete, truncate on public.shows, public.roles, public.cast_members, public.sessions, public.session_cast from anon;
grant select on public.shows, public.roles, public.cast_members, public.sessions, public.session_cast to anon, authenticated;
grant insert, update, delete on public.shows, public.roles, public.cast_members, public.sessions, public.session_cast to authenticated;
revoke truncate on public.shows, public.roles, public.cast_members, public.sessions, public.session_cast from authenticated;
