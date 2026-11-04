-- 0006: 이벤트 막대 색 (events.color)
-- 0004를 먼저 실행한 뒤 이 파일을 SQL Editor에서 한 번 실행하세요. 여러 번 실행해도 안전해요.
-- 비워 두면(null) 기본 색(검정/다크모드에선 흰색)으로 그려요. '#rrggbb' 형식만 받아요.

alter table public.events add column if not exists color text;
alter table public.events drop constraint if exists events_color_check;
alter table public.events add constraint events_color_check check (color is null or color ~ '^#[0-9a-fA-F]{6}$');
