import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { classifyPath, isBotUserAgent } from "@/lib/pageviews";

export const dynamic = "force-dynamic";

/**
 * 익명 페이지뷰 1회 기록. 응답은 항상 빈 204예요(통계 때문에 화면이 멈추거나 오류가 보이면 안 돼요).
 * 저장하는 값: 한국 날짜(DB가 계산), 페이지 유형, 공연 ID. 그 밖의 값(IP·UA·경로 원문·쿠키)은 저장하지 않아요.
 * 관리자 로그인 상태의 접속은 DB 함수가 걸러요(record_pageview가 is_admin()을 확인).
 */
const done = () => new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });

export async function POST(req: NextRequest) {
  try {
    // 1) 같은 사이트에서 보낸 요청만 (다른 사이트·스크립트가 마구 호출하는 것을 줄여요)
    const site = req.headers.get("sec-fetch-site");
    if (site && site !== "same-origin") return done();
    const origin = req.headers.get("origin");
    if (origin) { try { if (new URL(origin).host !== req.headers.get("host")) return done(); } catch { return done(); } }
    // 2) 봇·미리보기·프리페치 요청은 세지 않아요
    if (isBotUserAgent(req.headers.get("user-agent"))) return done();
    const purpose = `${req.headers.get("purpose") ?? ""}${req.headers.get("sec-purpose") ?? ""}`.toLowerCase();
    if (purpose.includes("prefetch") || purpose.includes("prerender")) return done();
    // 3) 본문은 아주 작은 JSON만 받아요
    if (Number(req.headers.get("content-length") ?? "0") > 512) return done();
    const body = (await req.json().catch(() => null)) as { p?: unknown } | null;
    const hit = classifyPath(body?.p);
    if (!hit) return done();
    const db = await createClient();
    const { error } = await db.rpc("record_pageview", { p_type: hit.type, p_show_id: hit.showId });
    if (error) console.error("[pv] 기록 실패(무시):", error.code ?? "", error.message?.slice(0, 120));
  } catch (e) {
    console.error("[pv] 오류(무시):", e instanceof Error ? e.message.slice(0, 120) : "unknown");
  }
  return done();
}

// 다른 방식의 요청은 아무것도 하지 않아요.
export const GET = () => new NextResponse(null, { status: 405 });
