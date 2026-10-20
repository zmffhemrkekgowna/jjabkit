import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * 1) 로그인 세션을 갱신하고,
 * 2) /admin 아래 주소(로그인 화면 제외)는 관리자만 통과시켜요.
 *    - 로그인하지 않음 → /admin/login
 *    - 로그인했지만 관리자가 아님 → 첫 화면(/)
 * 확인 중 오류가 나면 관리자 구역은 열지 않아요(차단이 기본값).
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const inAdmin = pathname === "/admin" || pathname.startsWith("/admin/");
  const needsAdmin = inAdmin && pathname !== "/admin/login";
  const go = (to: string) => NextResponse.redirect(new URL(to, request.url));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return needsAdmin ? go("/") : NextResponse.next();

  let response = NextResponse.next({ request });
  try {
    const supabase = createServerClient(url, key, {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (needsAdmin) {
      if (!user) return go("/admin/login");
      const { data: isAdmin } = await supabase.rpc("is_admin");
      if (isAdmin !== true) return go("/");
    }
    return response;
  } catch {
    return needsAdmin ? go("/") : NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
