import type { Notice } from "@/types/notice";

export const NOTICE_SEEN_KEY = "jjabkit-notice-seen";
/** 시각 비교는 문자열이 아니라 숫자로 해요. (DB가 소수점 자릿수를 다르게 돌려줄 수 있어요) */
const ts = (iso: string) => Date.parse(iso) || 0;

/** 마지막으로 소식을 열어 본 시각(ISO). 없거나 저장소를 못 쓰면 ''. */
export function readSeen(): string {
  try { return window.localStorage.getItem(NOTICE_SEEN_KEY) ?? ""; } catch { return ""; }
}

/** 열어 본 시각을 가장 최신 소식의 시각으로 저장해요. */
export function markSeen(notices: Notice[]): string {
  const latest = notices.reduce((m, n) => (ts(n.createdAt) > ts(m) ? n.createdAt : m), "");
  if (latest) { try { window.localStorage.setItem(NOTICE_SEEN_KEY, latest); } catch { /* 저장이 막혀도 이번 방문에서만 보여요 */ } }
  return latest;
}

/** seen 이후에 올라온 소식. seen이 비어 있으면(처음 방문) 전부 새 소식이에요. */
export const unreadOf = (notices: Notice[], seen: string): Notice[] => notices.filter((n) => ts(n.createdAt) > ts(seen));

/** 'YYYY.MM.DD' (한국 시간 기준) */
export function fmtNoticeDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 3600 * 1000);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${String(d.getUTCDate()).padStart(2, "0")}`;
}
