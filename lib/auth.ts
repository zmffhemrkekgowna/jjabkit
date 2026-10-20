import { createClient } from "@/lib/supabase/server";

export interface AuthState { signedIn: boolean; isAdmin: boolean }

/**
 * 서버에서 현재 방문자의 상태를 확인해요.
 * isAdmin은 DB의 is_admin() 함수 결과(admins 표에 등록된 계정인지)라서, 화면 코드가 임의로 바꿀 수 없어요.
 * 확인 중 오류가 나면 안전하게 '일반 방문자'로 취급해요.
 */
export async function getAuthState(): Promise<AuthState> {
  try {
    const db = await createClient();
    const { data: { user } } = await db.auth.getUser();
    if (!user) return { signedIn: false, isAdmin: false };
    const { data } = await db.rpc("is_admin");
    return { signedIn: true, isAdmin: data === true };
  } catch {
    return { signedIn: false, isAdmin: false };
  }
}
