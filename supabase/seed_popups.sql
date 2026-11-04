-- (선택) 팝업 광고 예시 2개. 모양을 보고 싶을 때만 실행하세요. 가상의 예시라서 실제 제휴처로 바꿔 쓰세요.
-- 관리자 화면 > 팝업 광고 탭에서 수정·삭제할 수 있어요. 여러 번 실행하면 예시가 계속 늘어나니 한 번만 실행하세요.
insert into public.popups (title, body, label, cta, link_url, gradient, sort_order) values
  ('별이 지는 밤에', E'(예시) 달빛컴퍼니 제작\n단 한 번의 계절, 가장 눈부신 이야기', '광고 · 제휴', '예매 안내 보기', 'https://example.com/sponsor-1', '#3b1d5a,#c2410c', 1),
  ('열두 번째 편지', E'(예시) 모래시계 프로덕션 제작\n세 사람의 엇갈린 편지가 닿는 곳', '광고 · 제휴', '자세히 보기', 'https://example.com/sponsor-2', '#0f3d3e,#b45309', 2);
