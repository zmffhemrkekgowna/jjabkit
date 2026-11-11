/** 이벤트 막대 색 고르기 도우미. 색은 '#rrggbb' 형식만 써요. */
export const isHex6 = (v: string) => /^#[0-9a-fA-F]{6}$/.test(v);

/** 바탕색 위에서 글자가 잘 읽히도록 흰색/검정을 골라요(WCAG 상대 휘도 기준). */
export function readableOn(hex: string): string {
  if (!isHex6(hex)) return "#ffffff";
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return L > 0.4 ? "#111111" : "#ffffff";
}

/** 막대 색 추천 8가지. */
export const EVENT_COLORS: { name: string; hex: string }[] = [
  { name: "빨강", hex: "#dc2626" }, { name: "주황", hex: "#ea580c" }, { name: "노랑", hex: "#facc15" }, { name: "초록", hex: "#16a34a" },
  { name: "파랑", hex: "#2563eb" }, { name: "보라", hex: "#7c3aed" }, { name: "분홍", hex: "#db2777" }, { name: "회색", hex: "#6b7280" },
];

/** 글자색을 흰색/검정 중 대비가 더 큰 쪽으로 골라요(WCAG 대비비 기준이라 어떤 바탕색에서도 최소 약 4.6:1). 이벤트 막대의 readableOn과 달리 공연 카드에만 써요. */
export function readableText(hex: string): string {
  if (!isHex6(hex)) return "#ffffff";
  const ch = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return 1.05 / (L + 0.05) >= (L + 0.05) / 0.05 ? "#ffffff" : "#000000";
}

/**
 * 공연 스케줄 색 팔레트 11가지. 버건디 디자인과 어울리는 차분한 색이고 형광색은 넣지 않았어요.
 * 새 공연에는 이 중 가장 적게 쓰인 색이 자동으로 배정돼요(supabase/migrations/0015의 pick_show_color와 같은 순서·같은 값이에요).
 */
export const SHOW_COLORS: { name: string; hex: string }[] = [
  { name: "로즈", hex: "#b4505f" }, { name: "스틸 블루", hex: "#4f78a8" }, { name: "세이지 그린", hex: "#4c8a6c" },
  { name: "오커", hex: "#b98433" }, { name: "바이올렛", hex: "#7658a6" }, { name: "틸", hex: "#3a8c96" },
  { name: "테라코타", hex: "#b8552f" }, { name: "올리브", hex: "#7b8a3a" }, { name: "플럼", hex: "#9c5589" },
  { name: "코코아", hex: "#8a6a4f" }, { name: "슬레이트", hex: "#6b7d8c" },
];
