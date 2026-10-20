# JJabKit (짭킷) — 최종 통합본

뮤지컬·연극 캐스팅 스케줄 앱이에요. Next.js 15 + Tailwind CSS 3 + Supabase(PostgreSQL, Auth, Storage)로 만들었어요.

- 누구나: 공연 목록·상세·캐스팅 스케줄·할인/이벤트 보기, 하트로 관심 공연·관심 배우 등록, 마이페이지에서 내 일정 모아보기, 상단 종 아이콘으로 업데이트·소식 보기, 달력 공유 및 PNG 저장
- 관리자(나)만: 공연·배역·배우·회차 등록·수정·삭제, 포스터 업로드, 소식(공지) 등록·수정·삭제, 전체 데이터 JSON 백업·복구

권한 구조와 데이터 구조의 자세한 내용은 `docs/PERMISSIONS.md`, 배포는 `DEPLOY.md`를 보세요.

## 권한 한눈에 보기

| 기능 | 일반 방문자 | 관리자 |
| --- | :---: | :---: |
| 공연 목록, 상세, 캐스팅 스케줄, 할인·이벤트 보기 | O | O |
| 하트 토글(관심 공연·관심 배우, 내 브라우저에 저장) | O | O |
| 마이페이지·내 일정 모아보기 | O | O |
| 업데이트·소식 보기(종 아이콘, 새 소식 N 배지) | O | O |
| 캐스팅 달력·내 일정 공유하기, PNG로 저장 | O | O |
| `/admin` 접근, 데이터 등록·수정·삭제 | X | O |
| 소식(공지) 등록·수정·삭제 | X | O |
| 전체 데이터 JSON 내려받기·불러오기 | X | O |

`/admin`은 세 겹으로 막혀요. ① `middleware.ts`(서버) ② `app/admin/(protected)/layout.tsx`(서버) ③ Supabase RLS(DB, 진짜 보안 경계). 하트는 서버로 가지 않고 방문자의 브라우저(localStorage)에만 저장돼요.

## 시작하기

1. Supabase 프로젝트를 만들고, SQL Editor에서 `supabase/migrations/0001_init.sql` 전체를 실행한 다음 `supabase/migrations/0003_notices_backup.sql`도 실행해요. (표, RLS 정책, 권한 정리, 포스터 저장소 / 소식 표와 백업 불러오기 함수. 0003을 빼먹으면 소식과 백업 기능만 안 되고 나머지는 그대로 동작해요)
2. Authentication > Users에서 내 이메일·비밀번호로 사용자를 추가하고, **신규 가입(sign up)은 꺼요.** SQL Editor에서 관리자로 등록해요.
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'me@example.com';
   ```
3. (선택) `supabase/seed.sql`을 실행하면 샘플 공연 5개가 들어가요.
4. `.env.local.example`을 `.env.local`로 복사해 프로젝트 URL과 공개 키를 넣어요. (`service_role` 키는 넣지 않아요)
5. `npm install` 후 `npm run dev` 를 실행해요.
6. `/admin/login`에서 로그인하고 `/admin`에서 데이터를 입력해요.
7. `supabase/tests/rls_check.sql`을 SQL Editor에서 실행해 권한을 점검해요. `ERROR: RLS 점검 결과`로 나오고 모든 줄이 `PASS`이면 정상이에요. (일부러 오류를 내 점검용 데이터를 모두 되돌려요)

## 프로젝트 구조

```
app/
  layout.tsx                    전체 틀: 상단 막대, 하트 저장소(FavoritesProvider)
  page.tsx                      / 공연 목록
  shows/[id]/page.tsx           공연 상세
  my/page.tsx                   마이페이지 (/my?tab=show|actor|sched)
  backup/page.tsx               데이터 백업 (내 하트 백업·불러오기, 관리자에겐 공연 백업 링크)
  admin/login/page.tsx          관리자 로그인 (누구나 열 수 있음)
  admin/(protected)/            관리자 전용 (layout.tsx가 두 번째 잠금)
    layout.tsx, page.tsx
middleware.ts                   첫 번째 잠금: /admin 아래 접근 검사, 로그인 세션 갱신
components/
  ModeBar.tsx                   상단 막대 (관리자 링크는 관리자에게만 보임)
  ShowList.tsx, ShowCard.tsx, ShowDetail.tsx, EventsTab.tsx
  casting/                      CastFilter, CastingScheduler, MonthView, WeekView, SessionSheet
  my/MyPage.tsx                 관심 공연·관심 배우·내 일정
  my/FavBackup.tsx              내 하트 JSON 내려받기·불러오기(합치기/바꾸기)
  BottomNav.tsx                 하단 메뉴 5칸 (홈·관심공연·관심배우·내일정·데이터 백업)
  admin/                        AdminPanel(탭), ShowsAdmin, NoticesAdmin, BackupPanel, LoginForm, ShowForm, RolesEditor, SessionsEditor
  ui/                           Poster, Avatar, Tags, HeartButton
  NoticeBell.tsx                상단 종 아이콘 + N 배지 + 소식 모달
  ShareBar.tsx                  '공유하기' / '달력 이미지로 저장(PNG)' 버튼
  ads/                          AdSenseBanner(반응형 배너), AdSenseScript(스크립트 로더), SponsorPopup(제휴 팝업)
lib/
  auth.ts                       서버에서 방문자 상태 확인(getAuthState: is_admin() 결과)
  favorites.tsx                 하트 저장(localStorage, 키 jjabkit-fav-v1)
  casting.ts, events.ts, mySchedule.ts
  notices.ts, db/notices.ts     소식: 새 소식 판단(localStorage), DB 조회·저장
  calendarImage.ts              달력 PNG 그리기(canvas) + 화면별 그릴 내용 만들기
  backup.ts                     백업 JSON 만들기·검사(순수 함수)
  favBackup.ts                  하트 백업 JSON 만들기·검사(순수 함수)
  download.ts                   파일 저장 도우미
  ads.ts                        애드센스 ID(환경변수), 팝업 24시간 숨김, 제휴 배너 데이터(SPONSORS)
  db/shows.ts                   Supabase 조회·저장 함수
  supabase/client.ts, server.ts
supabase/
  migrations/0001_init.sql      표 + RLS + 권한 정리 + 포스터 저장소 (새 프로젝트의 기본. 0003도 이어서 실행)
  migrations/0002_permissions.sql  예전 0001만 실행한 프로젝트용 권한 패치 (선택)
  migrations/0003_notices_backup.sql  소식(notices) 표 + import_shows() 함수
  seed.sql                      샘플 공연 5개
  tests/rls_check.sql           권한 점검 스크립트
docs/PERMISSIONS.md             권한·데이터 관리 구조
```

## 동작 규칙

- 배우 필터: 다른 배역의 배우를 함께 고르면 모두 출연하는 회차만, 같은 배역에서 여러 명을 고르면 그중 한 명이라도 출연하는 회차가 표시돼요.
- 관심 배우는 이름으로 저장해서, 같은 배우가 여러 공연에 나오면 내 일정에 한꺼번에 모여요. (동명이인은 같이 묶여요)
- 관리자 입력: 글자 입력은 칸을 벗어나거나 Enter를 눌렀을 때, 선택·체크박스는 바로 저장돼요.
- 같은 공연의 같은 날짜·시간 회차는 중복 등록이 막혀요. 배우를 삭제하면 그 배우의 회차는 "미정"이 돼요.

## 확인한 것과 아닌 것

- 확인함(코드): 타입 검사와 `next build` 통과, 배우 필터·하트·마이페이지 동작을 가상 브라우저로 점검.
- 확인함(권한, 가짜 Supabase 서버로 실제 앱 실행): 방문자는 목록·상세·마이페이지가 열리고 `/admin`은 로그인 화면으로 가며, 위조 토큰과 관리자가 아닌 계정도 차단되고, 관리자는 열려요. 인증 서버가 응답하지 않을 때도 `/admin`은 열리지 않아요. 보안 헤더와 검색 제외(noindex)도 확인했어요. (19개 항목)
- 확인함(DB, 실제 PostgreSQL 16에 Supabase와 같은 기본 권한을 흉내 내 적용): 방문자·일반 계정·관리자별 읽기·쓰기 권한 25개 항목이 모두 통과해요.
- 확인함(소식·백업·이미지, 이번 추가분): 백업 만들기·검사 25개 항목(Node), 새 표와 `import_shows()`의 권한·검증·전부 취소 동작 41개 + 점검 스크립트 33줄(실제 PostgreSQL 16), 소식 모달·N 배지·공유·PNG 저장·관리자 소식 등록/수정/삭제·백업 불러오기 흐름 49개(실제 Chromium, Supabase는 가짜로 대체), 달력 PNG를 실제로 그려 눈으로 확인.
- 확인함(하단 메뉴·하트 백업, 가짜 Supabase 서버로 실제 앱 실행): 5칸 순서·현재 칸 표시, `/my?tab=` 이동과 탭을 눌렀을 때 새로고침 없이 하단 메뉴가 따라가는 것, 내용이 메뉴에 가려지지 않는 것(360px), `/admin` 화면에서는 메뉴가 숨겨지는 것, 하트 내려받기·합치기·바꾸기·없는 공연 건너뛰기·잘못된 파일 거부, 방문자에게 관리자 칸이 안 보이는 것 (27개, 실제 Chromium). 한글 파일명으로 저장되는지는 실제 브라우저에서 확인하지 못했어요(테스트 브라우저의 한계).
- 확인 못 함: 진짜 Supabase 프로젝트와의 연결, 실제 Supabase 로그인, 포스터 업로드, Vercel 배포. 배포 후 `DEPLOY.md`의 확인 순서대로 한 번씩 봐 주세요.
- 버전: Next.js 15, React 19, Tailwind CSS 3, TypeScript 5. (TypeScript 7은 Next.js 15에서 설정 파일을 읽지 못해 쓰지 않았어요)

## 광고 영역 (2종)

| 종류 | 위치 | 설정 |
| --- | --- | --- |
| 구글 애드센스 반응형 배너 | 메인 목록 카드 6개 뒤(6개 이하면 목록 맨 아래), 공연 상세 맨 아래 | `.env.local`의 `NEXT_PUBLIC_ADSENSE_CLIENT`, `..._SLOT_LIST`, `..._SLOT_DETAIL` |
| 제휴 제작사 홍보 팝업 | 메인(`/`) 첫 진입 때만 | `lib/ads.ts`의 `SPONSORS` 배열 |

**애드센스**
- 승인받은 뒤 발급된 `ca-pub-숫자`와 광고 단위(슬롯) ID를 환경변수에 넣고 다시 배포하면 `<ins class="adsbygoogle">`가 실제 광고로 채워져요. (`NEXT_PUBLIC_*` 값은 빌드 때 들어가므로 바꾸면 재배포가 필요해요.)
- ID를 비워 두거나 `ca-pub-XXXX…` 같은 자리표시자 그대로면: 개발 중(`npm run dev`)에는 점선 자리표시자가, 운영(`npm run build` 후)에는 아무것도 보이지 않아요.
- 스크립트는 `/admin` 아래에서는 불러오지 않아요. 광고 위에는 "광고" 표시가 붙어요.
- 광고 높이를 미리 잡아 두어 늦게 떠도 화면이 밀리지 않아요. 한 번만 `push({})` 하도록 막아 두었어요.

**제휴 팝업**
- 오른쪽 위 **X**와 **닫기** 버튼, Esc, 바깥 클릭은 "이번만 닫기"예요. **오늘 하루 동안 보지 않기**를 누르면 24시간(LocalStorage 키 `jjabkit-sponsor-hide-until`) 동안 다시 안 떠요.
- `SPONSORS`의 예시 항목(가상의 제작사)을 실제 제휴처로 바꿔요. `image`에 포스터 이미지 주소를 넣으면 그 이미지를, 비우면 그라데이션 포스터를 보여줘요. 링크에는 `rel="sponsored"`가 붙어요.

**운영 전에 꼭 확인하세요 (코드로 해결되지 않는 부분)**
- 애드센스는 사이트 심사 후 승인돼야 광고가 나와요. 승인 전에는 비어 있을 수 있어요.
- 개인정보처리방침 페이지와, 방문자에게 쿠키·맞춤 광고 동의를 받는 안내(동의 관리)가 필요해요. 특히 EEA·영국·스위스 방문자에게는 구글 인증 동의 관리 플랫폼 사용이 요구돼요. 이 프로젝트에는 아직 들어 있지 않아요.
- 내 광고를 내가 클릭하거나 클릭을 유도하는 것은 정책 위반이에요.

## 업데이트·소식, 이미지 저장·공유, 백업·복구

**소식 (What's New)**
- 상단 막대의 종 아이콘을 누르면 소식 모달이 열려요. 마지막으로 열어 본 뒤에 올라온 소식이 있으면 아이콘에 **N** 배지가 떠요. (열어 본 시각은 이 브라우저의 localStorage `jjabkit-notice-seen`에 저장돼요. 처음 방문하면 올라와 있는 소식이 모두 새 소식이에요.)
- 관리자 화면 > **소식·공지** 탭에서 등록·수정·삭제해요. 종류(신규 공연, 스케줄 변경, 업데이트, 공지), 연결할 공연(선택), 맨 위 고정을 고를 수 있어요. 공연 관리 탭의 **이 공연 소식 쓰기** 버튼을 누르면 그 공연이 연결된 초안이 채워져요. 자동으로 올라가지는 않아요. 직접 써서 올려요.
- 본문은 글자 그대로 보여줘요(HTML을 해석하지 않아서 스크립트가 들어가도 실행되지 않아요). 제목 100자, 본문 2000자까지.
- 저장: Supabase `notices` 표. 읽기는 누구나, 쓰기는 관리자만(RLS). 소식을 못 불러와도 다른 화면은 그대로 떠요.

**달력 이미지 저장·공유**
- 공연 상세의 캐스팅 달력 위, 마이페이지 > 내 일정 위에 **공유하기**와 **달력 이미지로 저장(PNG)** 버튼이 있어요. 지금 보고 있는 달을 그대로 그려요. 주간 보기에서도 그 주가 속한 달이 저장돼요.
- 캐스팅 달력 이미지에는 선택한 배우 필터가 반영돼요. 마이페이지 이미지는 체크가 켜진 관심 배우의 일정만 담겨요.
- 화면 테마(다크/라이트)와 상관없이 항상 밝은 배경으로 그려요. 이미지는 브라우저 안에서만 만들어지고 서버로 보내지 않아요.
- 공유하기: 파일 공유를 지원하는 브라우저(주로 휴대폰)에서는 PNG를 함께 공유해요. 지원하지 않으면 문구와 링크만 공유하고, 공유 기능이 아예 없으면 문구를 복사해요. 마이페이지는 내 브라우저에만 있는 내용이라 링크는 보내지 않아요.

**관리자 백업·복구 (JSON)**
- 관리자 화면 > **백업·복구** 탭. 내려받기는 공연 정보, 배역, 배우, 회차, 회차별 캐스팅을 파일 하나로 저장해요. 배역·배우를 이름으로 이어서 다른 DB로 옮겨도 복구돼요. 소식과 포스터 이미지 파일은 담기지 않아요(포스터는 주소만).
- 불러오기는 먼저 파일을 검사해요(5MB 이하, 형식·날짜·시간·중복 회차·없는 배역/배우, 포스터 주소는 http(s)만). 문제가 있으면 어디가 문제인지 보여주고 아무것도 바꾸지 않아요.
- 방식 3가지: 새 공연만 추가(제목이 같으면 건너뜀, 기본) / 모두 추가 / 전체 교체(지금 공연을 모두 지우고 파일로 바꿈, 확인 체크 필요). DB 함수 `import_shows()`가 한 번에 처리해서, 중간에 오류가 나면 전부 취소돼요. 전체 교체 전에는 꼭 먼저 내려받아 두세요.

## 하단 메뉴와 하트 백업

- 화면 아래에 항상 떠 있는 메뉴: **홈 / 관심공연 / 관심배우 / 내일정 / 데이터 백업**. 관리자 화면(`/admin`)에서는 숨겨요. 공연 상세는 홈으로 쳐요.
- 관심공연·관심배우·내일정은 마이페이지의 각 탭(`/my?tab=show`, `/my?tab=actor`, `/my?tab=sched`)으로 바로 가요. 마이페이지 안에서 탭을 눌러도 주소와 하단 메뉴가 같이 바뀌어요.
- **데이터 백업**(`/backup`)은 누구나 열 수 있어요. 하트(관심 공연·관심 배우)는 이 브라우저에만 저장되니, JSON 파일로 내려받아 두었다가 브라우저를 바꾸거나 사이트 데이터를 지운 뒤 불러올 수 있어요. 불러올 때 공연은 id가 달라졌어도 제목으로 찾아 맞추고, 지금 없는 공연은 건너뛰어요. 방식은 *합치기*(기본) / *파일 내용으로 바꾸기*예요.
- 관리자로 로그인한 경우에만 같은 화면에 **공연 데이터 백업·복구** 칸이 보이고, 누르면 `/admin?tab=backup`으로 가요. (보이는 것만 다르고, 실제 권한은 서버와 DB가 따로 지켜요.)
