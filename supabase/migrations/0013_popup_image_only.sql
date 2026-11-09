-- 0013: 팝업 광고 '이미지만 표시' 옵션
-- 0004를 먼저 실행한 뒤 SQL Editor에서 실행하세요. 여러 번 실행해도 안전해요.
-- 기존 팝업은 모두 지금처럼(제목·문구·버튼이 이미지 위에 올라가는 방식) 그대로예요. 칸 1개만 더해요.
--   image_only = true  → 제목·문구·버튼·어두운 그림자·'광고' 글자 없이 이미지만 보여줘요(이미지 주소가 있어야 해요).
-- 되돌리기(필요하면): alter table public.popups drop constraint if exists popups_image_only_check; alter table public.popups drop column if exists image_only;

alter table public.popups add column if not exists image_only boolean not null default false;
alter table public.popups drop constraint if exists popups_image_only_check;
alter table public.popups add constraint popups_image_only_check check (not image_only or image_url is not null);
