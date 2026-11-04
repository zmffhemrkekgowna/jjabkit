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

/* ───────── 팝업 광고: "오늘 하루 동안 보지 않기" ─────────
 * 팝업은 관리자 화면(팝업 광고 탭)에서 여러 개 등록해요. 숨김은 팝업마다 따로 기억해요.
 * 저장 형태: { "<팝업 id>": 숨김이 끝나는 시각(ms) } — 새 팝업을 올리면 그것만 다시 떠요. */

export const POPUP_HIDE_KEY = "jjabkit-popup-hide-v1";
export const DAY_MS = 24 * 60 * 60 * 1000;

function readHidden(): Record<string, number> {
  try {
    const v = JSON.parse(window.localStorage.getItem(POPUP_HIDE_KEY) ?? "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, number>) : {};
  } catch {
    return {}; // localStorage를 못 쓰면 숨김 없음(=보여줘요)
  }
}

/** 아직 숨김 기간 안인 팝업 id가 아닌 것만 남겨요. */
export function visiblePopupIds(ids: string[], now = Date.now()): string[] {
  const h = readHidden();
  return ids.filter((id) => !(Number(h[id]) > now));
}

/** 주어진 팝업들을 지금부터 24시간 숨겨요. 지난 기록은 같이 정리해요. */
export function hidePopupsForToday(ids: string[], now = Date.now()): void {
  try {
    const h = readHidden();
    for (const k of Object.keys(h)) if (!(Number(h[k]) > now)) delete h[k];
    for (const id of ids) h[id] = now + DAY_MS;
    window.localStorage.setItem(POPUP_HIDE_KEY, JSON.stringify(h));
  } catch {
    /* 저장이 막힌 환경이면 이번 방문에서만 닫혀요 */
  }
}
