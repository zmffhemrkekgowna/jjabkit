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

/** 공연 스케줄 색 추천 9가지. */
export const SHOW_COLORS: { name: string; hex: string }[] = [
  { name: "노랑", hex: "#facc15" }, { name: "주황", hex: "#ea580c" }, { name: "빨강", hex: "#dc2626" },
  { name: "분홍", hex: "#db2777" }, { name: "보라", hex: "#7c3aed" }, { name: "파랑", hex: "#2563eb" },
  { name: "청록", hex: "#0d9488" }, { name: "초록", hex: "#16a34a" }, { name: "회색", hex: "#6b7280" },
];
