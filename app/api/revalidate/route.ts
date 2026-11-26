import { revalidatePath } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const done = (status: number) => new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });

/**
 * 관리자가 저장한 뒤 부르는 주소예요. 캐시해 둔 사용자 화면을 모두 새로 만들게 해요(즉시 반영).
 * 관리자(DB의 is_admin())만 실행할 수 있어요. 그 밖의 요청은 아무것도 하지 않아요.
 */
export async function POST(req: NextRequest) {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return done(403);
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return done(401);
    const { data: isAdmin } = await db.rpc("is_admin");
    if (isAdmin !== true) return done(403);
    revalidatePath("/", "layout"); // 첫 화면·오늘공연·공연 상세·마이페이지·안내 등 사용자 화면 전체
    return done(204);
  } catch (e) {
    console.error("[revalidate] 실패:", e instanceof Error ? e.message.slice(0, 120) : "unknown");
    return done(500);
  }
}

export const GET = () => done(405);
