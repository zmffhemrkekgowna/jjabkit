# 배포 가이드 (Supabase + Vercel)

대시보드의 메뉴 이름은 바뀔 수 있어요. 이름이 조금 달라도 같은 항목을 찾아 주세요.

## 1. Supabase 준비

1. 새 프로젝트를 만들어요. DB 비밀번호는 따로 보관해 주세요.
2. SQL Editor에서 `supabase/migrations/0001_init.sql` 전체를 붙여넣고 실행해요. (테이블, 보안 규칙, 권한 정리, 포스터 저장소가 한 번에 만들어져요.) 이어서 `supabase/migrations/0003_notices_backup.sql`도 실행해요. (소식 표와 백업 불러오기 함수. 여러 번 실행해도 안전해요. 0002는 예전 0001만 실행한 프로젝트용 패치라 새 프로젝트에는 필요 없어요)
3. 샘플 공연을 보고 싶으면 `supabase/seed.sql`도 실행해요. 지킬 앤 하이드, 시카고, 헤드윅, 햄릿, 리어왕 5개(회차 180개)가 들어가고, 다시 실행해도 중복되지 않아요. 지울 때는 관리자 화면에서 공연을 삭제하면 돼요.
4. Authentication > Users에서 내 이메일과 비밀번호로 사용자를 추가해요.
5. SQL Editor에서 관리자로 등록해요. (이메일은 내 것으로)
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'me@example.com';
   ```
6. 개인용이라면 Auth 설정에서 신규 가입(sign up)을 꺼 두는 걸 권장해요. 관리자 등록이 따로 있어서 가입이 열려 있어도 남이 고칠 수는 없지만, 계정이 불필요하게 늘어나지 않아요.
7. 프로젝트 설정의 API 항목에서 Project URL과 공개 키(anon 또는 publishable)를 복사해 둬요. service_role 키는 쓰지 않아요.

## 2. Vercel 배포

1. `jjabkit-app` 폴더를 GitHub 저장소에 올려요. `.env.local`은 `.gitignore`에 들어 있어서 올라가지 않아요.
2. Vercel에서 새 프로젝트를 만들고 그 저장소를 가져와요. Next.js는 자동으로 인식돼요.
3. Environment Variables에 아래 두 개를 넣어요.

   | 이름 | 값 |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase의 Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase의 공개 키 |

4. Deploy를 눌러요.
5. 값을 나중에 바꾸면 다시 배포해야 반영돼요. `NEXT_PUBLIC_`으로 시작하는 값은 빌드할 때 코드에 들어가기 때문이에요.

## 3. 배포 후 확인

1. 배포된 주소의 첫 화면에 공연 목록이 나오는지 봐요. (시드를 넣었다면 5개)
2. 로그인하지 않은 상태(시크릿 창)에서 `/admin`으로 들어가면 `/admin/login`으로 이동하는지 확인해요. 상단 막대에 "관리자 화면" 링크가 없는지도 봐요.
3. `/admin/login`에서 로그인하면 `/admin`의 공연 관리 화면이 열리는지 확인해요. 관리자로 등록하지 않은 계정으로 로그인하면 거부되는지도 확인해요.
4. 관리자에서 회차를 하나 추가하고, 사용자 화면 달력에 바로 나오는지 확인해요.
5. 포스터 파일을 올려 보고 목록과 상세에 보이는지 확인해요.
6. 관리자 화면 > 소식·공지 탭에서 소식을 하나 올리고, 사용자 화면 상단 종 아이콘에 N 배지가 뜨는지, 열면 보이는지 확인해요. (안 되면 0003을 실행했는지 확인)
7. 관리자 화면 > 백업·복구 탭에서 JSON을 내려받아 열어 봐요. 사용자 화면의 달력 위 "달력 이미지로 저장(PNG)"으로 이미지가 받아지는지도 확인해요.

## 문제가 생기면

| 증상 | 확인할 것 |
| --- | --- |
| "데이터를 불러오지 못했어요" | 환경변수 두 개가 맞는지, 0001_init.sql을 실행했는지, 값을 바꾼 뒤 다시 배포했는지 |
| `rls_check.sql` 결과에 FAIL이 있음 | 예전 버전의 0001만 실행했다면 `0002_permissions.sql`을 한 번 실행해요 (특히 admins 표 읽기 차단 항목) |
| 로그인했는데 `/admin`이 홈으로 돌아감 | 5번의 관리자 등록 SQL을 실행했는지, 로그인한 이메일과 같은지 |
| 저장할 때 "권한이 없어요" | 관리자 계정으로 로그인했는지 |
| 소식·백업에서 "0003 … 적용되지 않았어요" | `0003_notices_backup.sql`을 SQL Editor에서 실행 |
| 백업 불러오기가 "백업 내용에 문제가 있어요" | 파일의 배역·배우 이름이 회차의 cast와 맞는지. 화면에 나온 오류 목록을 따라 고쳐요 |
| 회차 추가 시 "같은 날짜·시간의 회차가 이미 있어요" | 같은 공연에 같은 날짜·시간 회차가 이미 있어요 |

## 로컬에서 실행

```bash
cp .env.local.example .env.local   # 값을 채워요
npm install
npm run dev
```

## 광고 환경변수 (선택)

Vercel > Settings > Environment Variables 에 아래 세 개를 추가하고 **다시 배포**해요. 비워 두면 광고는 나오지 않아요.

| 이름 | 값 예시 |
| --- | --- |
| `NEXT_PUBLIC_ADSENSE_CLIENT` | `ca-pub-1234567890123456` |
| `NEXT_PUBLIC_ADSENSE_SLOT_LIST` | 메인 목록용 광고 단위 ID(숫자) |
| `NEXT_PUBLIC_ADSENSE_SLOT_DETAIL` | 공연 상세용 광고 단위 ID(숫자) |

애드센스 승인, 개인정보처리방침, 동의 안내는 README의 "광고 영역" 부분을 확인해요.
