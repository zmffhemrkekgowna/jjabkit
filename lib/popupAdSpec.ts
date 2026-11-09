/**
 * 이용 안내 '팝업 광고 문의' 페이지에 보여줄 규격. 값은 components/ads/SponsorPopup.tsx 와 lib/db/popups.ts·PopupsAdmin.tsx 의 실제 코드에서 가져왔어요.
 *  - 비율: SponsorPopup 의 이미지 영역 `aspect-[4/5]` (가로:세로 = 4:5). 이미지는 `object-cover` 라서 비율이 다르면 가운데 기준으로 잘려요.
 *  - 가로 크기: 팝업 상자 `max-w-sm` = 24rem = 384px(CSS px)이고 테두리 1px씩을 빼면 이미지 영역은 가로 약 382px, 비율 4:5 → 세로 약 478px(PC에서 실측). 고해상도 화면용 권장 제작 크기는 그 2배보다 조금 큰 768×960.
 *  - 글자 수: PopupsAdmin 입력 제한(제목 60 · 문구 300 · 왼쪽 위 표시 40 · 버튼 20).
 * 이 값이 팝업 코드와 어긋나면 테스트(수동 점검)에서 잡을 수 있게 한곳에 모아 둬요. 팝업 코드는 건드리지 않아요.
 */
export const POPUP_AD = {
  ratioW: 4,
  ratioH: 5,
  displayW: 382,
  displayH: 478,
  recommendW: 768,
  recommendH: 960,
  maxTitle: 60,
  maxBody: 300,
  maxLabel: 40,
  maxCta: 20,
} as const;

/** 문의 페이지 본문에서 처음 나오는 이메일 주소를 찾아요(없으면 빈 문자열). 새 주소를 만들어 내지 않아요. */
export function findEmail(text: string): string {
  const m = text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/);
  return m ? m[0] : "";
}
