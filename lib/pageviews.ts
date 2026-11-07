/**
 * 익명 페이지뷰 집계의 순수 로직(서버 라우트와 테스트가 함께 써요).
 * 저장하는 것은 "페이지 유형 + (공연 상세일 때) 공연 ID"뿐이고, 경로 원문·User-Agent·IP는 저장하지 않아요.
 */
export type PageType = "home" | "today" | "show" | "my" | "backup" | "guide" | "info" | "other";
export interface PageHit { type: PageType; showId: string | null }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 주소(경로)를 집계용 유형으로 바꿔요. 집계하지 않는 곳(관리자·API·정적 파일)은 null. */
export function classifyPath(raw: unknown): PageHit | null {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > 200 || raw[0] !== "/") return null;
  const path = raw.split(/[?#]/)[0].replace(/\/+$/, "") || "/";
  if (path === "/") return { type: "home", showId: null };
  const seg = path.split("/").filter(Boolean);
  switch (seg[0]) {
    case "admin": case "api": case "_next": return null;
    case "today": return seg.length === 1 ? { type: "today", showId: null } : null;
    case "my": return seg.length === 1 ? { type: "my", showId: null } : null;
    case "backup": return seg.length === 1 ? { type: "backup", showId: null } : null;
    case "guide": return seg.length <= 2 ? { type: "guide", showId: null } : null;
    case "about": case "contact": case "privacy": return seg.length === 1 ? { type: "info", showId: null } : null;
    case "shows": return seg.length === 2 && UUID.test(seg[1]) ? { type: "show", showId: seg[1].toLowerCase() } : null;
    default: return null; // 모르는 주소(404 등)는 세지 않아요
  }
}

/** 봇·자동화 요청을 거르는 기본 필터. User-Agent는 이 판정에만 쓰고 저장하지 않아요. */
const BOT = /bot|crawl|spider|slurp|scrape|headless|phantom|lighthouse|pagespeed|gtmetrix|pingdom|uptime|monitor|preview|facebookexternalhit|embedly|curl|wget|python|httpclient|okhttp|java\/|go-http|node-fetch|axios|undici|libwww|postman|insomnia/i;
export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 10) return true; // UA가 없거나 너무 짧으면 자동화 요청으로 봐요
  return BOT.test(ua);
}
