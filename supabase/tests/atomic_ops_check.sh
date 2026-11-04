P="psql -h /var/tmp/pgtest -p 54329 -U postgres -d t -tA -q"
ok=0; bad=0
chk(){ if [ "$2" = "$3" ]; then ok=$((ok+1)); echo "PASS $1"; else bad=$((bad+1)); echo "FAIL $1 (got: $2 / want: $3)"; fi; }
q(){ out=$($P -v ON_ERROR_STOP=1 -c "set role $1; select set_config('request.jwt.claim.sub','$2',false); $3" 2>&1 | tail -n +2); if echo "$out" | grep -q "^ERROR\|^psql:"; then echo "ERR"; else echo "$out" | grep -v '^$' | tail -1; fi; }
qe(){ $P -v ON_ERROR_STOP=1 -c "set role $1; select set_config('request.jwt.claim.sub','$2',false); $3" 2>&1 | grep -m1 "ERROR" | sed 's/.*ERROR:  //'; }
ADMIN=11111111-1111-1111-1111-111111111111; USER=22222222-2222-2222-2222-222222222222
$P -c "truncate public.shows cascade; delete from public.admins; delete from auth.users; insert into auth.users(id,email) values ('$ADMIN','a@x'),('$USER','u@x'); insert into public.admins values ('$ADMIN');"
S1=a0000000-0000-4000-8000-000000000001; S2=a0000000-0000-4000-8000-000000000002
R1=b0000000-0000-4000-8000-000000000001; R2=b0000000-0000-4000-8000-000000000002; R3=b0000000-0000-4000-8000-000000000003
M1=c0000000-0000-4000-8000-000000000001; M2=c0000000-0000-4000-8000-000000000002; M3=c0000000-0000-4000-8000-000000000003
X1=d0000000-0000-4000-8000-000000000001; X2=d0000000-0000-4000-8000-000000000002; X3=d0000000-0000-4000-8000-000000000003; X4=d0000000-0000-4000-8000-000000000004
Y1=d1000000-0000-4000-8000-000000000001
E1=e0000000-0000-4000-8000-000000000001
$P -c "insert into public.shows(id,title) values ('$S1','공연1'),('$S2','공연2');
insert into public.roles(id,show_id,name,short_name,sort_order) values ('$R1','$S1','주역','주',0),('$R2','$S1','조연','조',1),('$R3','$S2','타공연역','타',0);
insert into public.cast_members(id,role_id,name,sort_order) values ('$M1','$R1','갑',0),('$M2','$R1','을',1),('$M3','$R2','병',0);
insert into public.sessions(id,show_id,starts_on,starts_at,is_curtain_call) values ('$X1','$S1','2026-11-10','14:00',true),('$X2','$S1','2026-11-10','19:00',false),('$X3','$S1','2026-11-11','19:00',false),('$X4','$S1','2026-11-12','19:00',false),('$Y1','$S2','2026-11-10','19:00',false);
insert into public.session_cast(session_id,role_id,cast_member_id) values ('$X1','$R1','$M1'),('$X1','$R2','$M3'),('$X2','$R1','$M2'),('$X2','$R2',null),('$X3','$R1','$M1');
insert into public.events(id,title,show_id,starts_on) values ('$E1','이벤트','$S1','2026-11-01');"
cnt(){ $P -c "select count(*) from public.sessions where show_id='$S1'"; }
echo "--- 권한"
chk "anon cannot delete_sessions" "$(q anon '' "select public.delete_sessions('$S1','{$X1}');")" "ERR"
chk "non-admin delete_sessions raises" "$(qe authenticated $USER "select public.delete_sessions('$S1','{$X1}');")" "permission denied: admin only"
chk "non-admin bulk_update raises" "$(qe authenticated $USER "select public.bulk_update_sessions('$S1','[]');")" "permission denied: admin only"
chk "non-admin delete_show_bundle raises" "$(qe authenticated $USER "select public.delete_show_bundle('$S1');")" "permission denied: admin only"
chk "non-admin restore_show_bundle raises" "$(qe authenticated $USER "select public.restore_show_bundle('{}');")" "permission denied: admin only"
chk "non-admin restore_sessions raises" "$(qe authenticated $USER "select public.restore_sessions('$S1','[]');")" "permission denied: admin only"
chk "anon cannot delete_show_bundle" "$(q anon '' "select public.delete_show_bundle('$S1');")" "ERR"
chk "nothing deleted by denied calls" "$(cnt)" "4"
echo "--- 일괄 삭제 원자성"
chk "unknown id → whole batch rolled back" "$(q authenticated $ADMIN "select public.delete_sessions('$S1','{$X1,$X2,f0000000-0000-4000-8000-000000000009}');")" "ERR"
chk "still 4 sessions after failed batch" "$(cnt)" "4"
chk "id of OTHER show → whole batch rolled back" "$(q authenticated $ADMIN "select public.delete_sessions('$S1','{$X1,$Y1}');")" "ERR"
chk "other show's session untouched" "$($P -c "select count(*) from public.sessions where id='$Y1'")" "1"
chk "still 4" "$(cnt)" "4"
chk "empty array deletes nothing" "$(q authenticated $ADMIN "select public.delete_sessions('$S1','{}');")" "0"
chk "duplicates in ids counted once" "$(q authenticated $ADMIN "select public.delete_sessions('$S1','{$X4,$X4}');")" "1"
chk "valid batch deletes 2" "$(q authenticated $ADMIN "select public.delete_sessions('$S1','{$X1,$X2}');")" "2"
chk "1 session left" "$(cnt)" "1"
chk "casting of deleted gone (cascade)" "$($P -c "select count(*) from public.session_cast where session_id in ('$X1','$X2')")" "0"
echo "--- 복구(캐스팅 보존, 같은 id)"
J="[{\"id\":\"$X1\",\"date\":\"2026-11-10\",\"time\":\"14:00\",\"curtain\":true,\"timesale\":false,\"cast\":{\"$R1\":\"$M1\",\"$R2\":\"$M3\"}},{\"id\":\"$X2\",\"date\":\"2026-11-10\",\"time\":\"19:00\",\"curtain\":false,\"timesale\":false,\"cast\":{\"$R1\":\"$M2\",\"$R2\":\"\"}}]"
chk "restore_sessions returns counts" "$(q authenticated $ADMIN "select public.restore_sessions('$S1','$J'::jsonb);")" '{"uncast": 0, "dropped": 0, "restored": 2}'
chk "ids preserved" "$($P -c "select count(*) from public.sessions where id in ('$X1','$X2')")" "2"
chk "casting restored X1 (갑·병)" "$($P -c "select string_agg(m.name,',' order by m.name) from public.session_cast c join public.cast_members m on m.id=c.cast_member_id where c.session_id='$X1'")" "갑,병"
chk "X2 주역 을, 조연 미정" "$($P -c "select count(*) from public.session_cast where session_id='$X2' and ((role_id='$R1' and cast_member_id='$M2') or (role_id='$R2' and cast_member_id is null))")" "2"
chk "curtain flag preserved" "$($P -c "select is_curtain_call from public.sessions where id='$X1'")" "t"
# 배우 하나가 사라진 뒤 복구: 그 배우만 미정, 나머지 유지
$P -c "delete from public.session_cast where session_id in ('$X1','$X2'); delete from public.sessions where id in ('$X1','$X2'); delete from public.cast_members where id='$M1';"
chk "restore with a vanished actor: only that one uncast" "$(q authenticated $ADMIN "select public.restore_sessions('$S1','$J'::jsonb);")" '{"uncast": 1, "dropped": 0, "restored": 2}'
chk "X1: 갑 미정, 병 유지" "$($P -c "select count(*) from public.session_cast where session_id='$X1' and ((role_id='$R1' and cast_member_id is null) or (role_id='$R2' and cast_member_id='$M3'))")" "2"
chk "X2 casting kept (을)" "$($P -c "select cast_member_id from public.session_cast where session_id='$X2' and role_id='$R1'")" "$M2"
$P -c "insert into public.cast_members(id,role_id,name,sort_order) values ('$M1','$R1','갑',0); update public.session_cast set cast_member_id='$M1' where session_id='$X1' and role_id='$R1';"
echo "--- 일괄 수정 원자성"
$P -c "insert into public.sessions(id,show_id,starts_on,starts_at) values ('$X4','$S1','2026-11-12','19:00') on conflict do nothing;"
# X1(11-10 14:00) -> 19:00 은 X2(11-10 19:00)와 충돌 → 앞의 X3(11-11 19:00→21:00)까지 모두 롤백
B="[{\"id\":\"$X3\",\"date\":\"2026-11-11\",\"time\":\"21:00\"},{\"id\":\"$X1\",\"date\":\"2026-11-10\",\"time\":\"19:00\"}]"
chk "unique clash → error" "$(q authenticated $ADMIN "select public.bulk_update_sessions('$S1','$B'::jsonb);")" "ERR"
chk "X3 unchanged after rollback" "$($P -c "select starts_at from public.sessions where id='$X3'")" "19:00:00"
chk "X1 unchanged after rollback" "$($P -c "select starts_at from public.sessions where id='$X1'")" "14:00:00"
B="[{\"id\":\"$X3\",\"date\":\"2026-11-11\",\"time\":\"21:00\"},{\"id\":\"$X4\",\"date\":\"2026-11-12\",\"time\":\"21:00\"}]"
chk "valid bulk update returns 2" "$(q authenticated $ADMIN "select public.bulk_update_sessions('$S1','$B'::jsonb);")" "2"
chk "both changed" "$($P -c "select count(*) from public.sessions where id in ('$X3','$X4') and starts_at='21:00'")" "2"
chk "casting rows untouched when no cast key" "$($P -c "select count(*) from public.session_cast where session_id='$X3'")" "1"
chk "curtain flag untouched when absent" "$($P -c "select is_curtain_call from public.sessions where id='$X1'")" "t"
chk "other show's id in batch → error + rollback" "$(q authenticated $ADMIN "select public.bulk_update_sessions('$S1','[{\"id\":\"$X3\",\"date\":\"2026-11-11\",\"time\":\"22:00\"},{\"id\":\"$Y1\",\"date\":\"2026-11-10\",\"time\":\"22:00\"}]'::jsonb);")" "ERR"
chk "X3 still 21:00" "$($P -c "select starts_at from public.sessions where id='$X3'")" "21:00:00"
chk "other show session untouched" "$($P -c "select starts_at from public.sessions where id='$Y1'")" "19:00:00"
echo "--- 공연 소속 검증 트리거"
chk "role of another show rejected on insert" "$(q authenticated $ADMIN "insert into public.session_cast(session_id,role_id) values ('$X4','$R3');")" "ERR"
chk "bulk update with cast of other show's role → rollback" "$(q authenticated $ADMIN "select public.bulk_update_sessions('$S1','[{\"id\":\"$X4\",\"date\":\"2026-11-12\",\"time\":\"20:00\",\"cast\":{\"$R3\":\"\"}}]'::jsonb);")" "ERR"
chk "X4 time not changed" "$($P -c "select starts_at from public.sessions where id='$X4'")" "21:00:00"
chk "same-show role accepted" "$(q authenticated $ADMIN "insert into public.session_cast(session_id,role_id) values ('$X4','$R1') returning 1;")" "1"
echo "--- 공연 삭제/복구 번들"
H(){ $P -c "select md5(string_agg(x,'|' order by x)) from (
 select 's:'||to_jsonb(s)::text x from public.shows s where id='$S1'
 union all select 'r:'||to_jsonb(r)::text from public.roles r where show_id='$S1'
 union all select 'm:'||to_jsonb(m)::text from public.cast_members m join public.roles r on r.id=m.role_id where r.show_id='$S1'
 union all select 'x:'||to_jsonb(x)::text from public.sessions x where show_id='$S1'
 union all select 'c:'||to_jsonb(c)::text from public.session_cast c join public.sessions x on x.id=c.session_id where x.show_id='$S1'
 union all select 'e:'||to_jsonb(e)::text from public.events e where show_id='$S1') t"; }
BEFORE=$(H)
$P -c "create table if not exists public.bundle_tmp(b jsonb); truncate public.bundle_tmp; grant all on public.bundle_tmp to authenticated;"
chk "delete_show_bundle returns snapshot" "$(q authenticated $ADMIN "insert into public.bundle_tmp select public.delete_show_bundle('$S1'); select jsonb_array_length(b->'sessions')||','||jsonb_array_length(b->'roles')||','||jsonb_array_length(b->'cast_members')||','||jsonb_array_length(b->'events') from public.bundle_tmp;")" "4,2,3,1"
chk "show gone" "$($P -c "select count(*) from public.shows where id='$S1'")" "0"
chk "children gone (roles/sessions/events/casting)" "$($P -c "select (select count(*) from public.roles where show_id='$S1')+(select count(*) from public.sessions where show_id='$S1')+(select count(*) from public.events where show_id='$S1')+(select count(*) from public.session_cast where session_id in ('$X1','$X2','$X3','$X4'))")" "0"
chk "other show untouched" "$($P -c "select count(*) from public.sessions where show_id='$S2'")" "1"
chk "restore_show_bundle ok" "$(q authenticated $ADMIN "select public.restore_show_bundle(b) from public.bundle_tmp;")" '{"uncast": 0, "dropped": 0}'
chk "restored data is hash-identical (all ids, casting, events)" "$(H)" "$BEFORE"
chk "restore again fails (duplicate) & leaves state" "$(q authenticated $ADMIN "select public.restore_show_bundle(b) from public.bundle_tmp;")" "ERR"
chk "still hash-identical" "$(H)" "$BEFORE"
echo "--- 번들 복구 중간 실패 → 전체 롤백"
$P -c "truncate public.bundle_tmp;"
q authenticated $ADMIN "insert into public.bundle_tmp select public.delete_show_bundle('$S1');" >/dev/null
$P -c "update public.bundle_tmp set b = jsonb_set(b, '{sessions}', (b->'sessions') || (b->'sessions'->0));"
chk "bundle with duplicate session row → error" "$(q authenticated $ADMIN "select public.restore_show_bundle(b) from public.bundle_tmp;")" "ERR"
chk "nothing partially restored" "$($P -c "select (select count(*) from public.shows where id='$S1')+(select count(*) from public.roles where show_id='$S1')+(select count(*) from public.events where show_id='$S1')")" "0"
$P -c "update public.bundle_tmp set b = jsonb_set(b, '{sessions}', (select jsonb_agg(distinct x) from jsonb_array_elements(b->'sessions') x))"

chk "restore ok" "$(q authenticated $ADMIN "select public.restore_show_bundle(b) from public.bundle_tmp;")" '{"uncast": 0, "dropped": 0}'
chk "hash-identical again" "$(H)" "$BEFORE"
echo "--- 번들: 배우가 그 사이 다른 데이터로 바뀐 경우 부분 미정"
$P -c "truncate public.bundle_tmp;"
q authenticated $ADMIN "insert into public.bundle_tmp select public.delete_show_bundle('$S1');" >/dev/null
# 번들의 캐스팅 한 줄을 존재하지 않는 배우로 바꿔 놓는다
$P -c "update public.bundle_tmp set b = jsonb_set(b,'{session_cast,0,cast_member_id}','\"f0000000-0000-4000-8000-0000000000aa\"');"
chk "bundle with unknown actor → only that casting uncast" "$(q authenticated $ADMIN "select public.restore_show_bundle(b) from public.bundle_tmp;")" '{"uncast": 1, "dropped": 0}'
chk "other castings kept" "$($P -c "select count(*) from public.session_cast c join public.sessions x on x.id=c.session_id where x.show_id='$S1' and c.cast_member_id is not null")" "3"
echo "--- 이벤트 표가 없는 DB"
$P -c "begin; alter table public.events rename to events_off; select 1; commit;" >/dev/null
chk "delete_show_bundle works without events table" "$(q authenticated $ADMIN "select jsonb_array_length((public.delete_show_bundle('$S1'))->'events');")" "0"
$P -c "alter table public.events_off rename to events;"
echo "--- 다른 오류는 숨기지 않음"
chk "delete unknown show → error" "$(qe authenticated $ADMIN "select public.delete_show_bundle('f0000000-0000-4000-8000-0000000000bb');")" "show not found: f0000000-0000-4000-8000-0000000000bb"
chk "bad bundle → error" "$(q authenticated $ADMIN "select public.restore_show_bundle('{\"show\":{}}');")" "ERR"
echo "--- 0008 재실행(멱등)"
chk "re-run 0008 ok" "$($P -v ON_ERROR_STOP=1 -f /home/claude/work/app/supabase/migrations/0008_atomic_admin_ops.sql 2>&1 | grep -c "ERROR")" "0"
echo "== $ok pass, $bad fail"
