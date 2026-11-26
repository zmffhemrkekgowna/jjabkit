import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * 쿠키를 읽지 않는 공개 읽기 전용 연결이에요(로그인 정보 없이 '방문자'로 읽어요).
 * 사용자 화면은 모두 이 연결을 써서, 페이지를 한 번 만들어 두고 여러 방문자에게 그대로 보여줄 수 있어요(캐시).
 * 공개 읽기 권한(RLS)은 방문자·관리자가 같아서, 화면에 보이는 데이터도 예전과 같아요.
 * 환경변수가 없으면 null이에요.
 */
export function createPublicClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

/** 꼭 DB가 있어야 하는 화면용. 환경변수가 없으면 분명한 오류를 내요. */
export function requirePublicClient(): SupabaseClient {
  const db = createPublicClient();
  if (!db) throw new Error("Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)가 없어요.");
  return db;
}
