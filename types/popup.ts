export interface Popup {
  id: string;
  title: string;
  body: string;
  /** 왼쪽 위 작은 표시(예: '광고 · 제휴'). 비우면 '광고'로 보여요. */
  label: string;
  cta: string;
  linkUrl: string;
  imageUrl: string;
  /** '#rrggbb,#rrggbb' — 이미지가 없을 때 배경 그라데이션 */
  gradient: string;
  startsOn: string;
  endsOn: string;
  /** true면 제목·문구·버튼·그림자·'광고' 글자 없이 이미지만 보여줘요(이미지가 있어야 해요). */
  imageOnly: boolean;
  active: boolean;
  sortOrder: number;
  createdAt: string;
}
