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

const MISSING_ENV = "Supabase 환경변수(NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY)가 없어요.";
const isBuild = () => process.env.NEXT_PHASE === "phase-production-build";

/** 꼭 DB가 있어야 하는 화면용. 환경변수가 없으면 분명한 오류를 내요. */
export function requirePublicClient(): SupabaseClient {
  const db = createPublicClient();
  if (!db) throw new Error(MISSING_ENV);
  return db;
}

/**
 * 공개 데이터를 읽어요. 환경변수가 없는 빌드(예: 환경변수를 넣지 않은 Vercel 미리보기 배포)에서는
 * 빌드가 실패하지 않도록 빈 값(fallback)으로 만들어 두고, 실제 방문 때 다시 만들어요(아래 revalidate).
 * 실제 서비스 중(빌드가 아닐 때) 환경변수가 없으면 예전처럼 오류를 내요.
 */
export async function readPublic<T>(fn: (db: SupabaseClient) => Promise<T>, fallback: T): Promise<T> {
  const db = createPublicClient();
  if (db) return fn(db);
  if (isBuild()) return fallback;
  throw new Error(MISSING_ENV);
}
