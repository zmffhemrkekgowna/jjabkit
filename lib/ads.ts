/**
 * 광고 설정과 보조 함수.
 * - 애드센스 ID는 환경변수에서만 읽어요. 코드에 직접 적지 않아요.
 * - NEXT_PUBLIC_* 값은 빌드 때 코드에 들어가요. 값을 바꾸면 다시 배포해야 해요.
 */

export const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT ?? "";
export const ADSENSE_SLOT_LIST = process.env.NEXT_PUBLIC_ADSENSE_SLOT_LIST ?? "";
export const ADSENSE_SLOT_DETAIL = process.env.NEXT_PUBLIC_ADSENSE_SLOT_DETAIL ?? "";

/** 자리표시자("ca-pub-XXXX…")나 잘못된 값은 "설정 안 됨"으로 봐요. */
export const isValidClient = (v: string) => /^ca-pub-\d{10,20}$/.test(v);
export const isValidSlot = (v: string) => /^\d{5,15}$/.test(v);

/* ───────── 스폰서십 팝업: "오늘 하루 동안 보지 않기" ───────── */

export const SPONSOR_HIDE_KEY = "jjabkit-sponsor-hide-until";
export const DAY_MS = 24 * 60 * 60 * 1000;

/** 저장된 숨김 만료 시각이 아직 안 지났으면 true. localStorage를 못 쓰면 false(=보여줘요). */
export function isSponsorHidden(now = Date.now()): boolean {
  try {
    const raw = window.localStorage.getItem(SPONSOR_HIDE_KEY);
    const until = raw ? Number(raw) : 0;
    return Number.isFinite(until) && until > now;
  } catch {
    return false;
  }
}

/** 지금부터 24시간 동안 팝업을 숨겨요. */
export function hideSponsorForToday(now = Date.now()): void {
  try {
    window.localStorage.setItem(SPONSOR_HIDE_KEY, String(now + DAY_MS));
  } catch {
    /* 저장이 막힌 환경이면 이번 방문에서만 닫혀요 */
  }
}

/* ───────── 제휴 제작사 배너 데이터 ─────────
 * 아래 항목은 모양을 보여주려는 가상의 예시예요. 실제 제휴처로 바꿔 쓰세요.
 * image 에 포스터 이미지 주소를 넣으면 그 이미지를, 비우면 그라데이션 포스터를 보여줘요. */

export type Sponsor = {
  id: string;
  producer: string;
  title: string;
  tagline: string;
  period: string;
  venue: string;
  cta: string;
  href: string;
  image?: string;
  from: string;
  to: string;
};

export const SPONSORS: Sponsor[] = [
  {
    id: "sample-1", producer: "(예시) 달빛컴퍼니", title: "별이 지는 밤에", tagline: "단 한 번의 계절, 가장 눈부신 이야기",
    period: "2026.12.05 – 2027.02.28", venue: "OO아트센터 대극장", cta: "예매 안내 보기", href: "https://example.com/sponsor-1",
    from: "#3b1d5a", to: "#c2410c",
  },
  {
    id: "sample-2", producer: "(예시) 모래시계 프로덕션", title: "열두 번째 편지", tagline: "세 사람의 엇갈린 편지가 닿는 곳",
    period: "2026.11.20 – 2027.01.31", venue: "OO소극장", cta: "자세히 보기", href: "https://example.com/sponsor-2",
    from: "#0f3d3e", to: "#b45309",
  },
];
