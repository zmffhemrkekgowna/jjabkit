"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * 이 브라우저가 관리자로 로그인했는지 확인해요(화면 편의용: 관리자 링크·관리자 전용 버튼 표시).
 * 사용자 화면을 캐시하려고 서버 대신 브라우저에서 확인해요.
 * - 로그인 기록이 없는 일반 방문자는 네트워크 요청 없이 바로 false예요.
 * - 실제 접근 차단은 예전처럼 서버(middleware)와 DB(RLS)가 해요.
 */
let cached: Promise<boolean> | null = null;

function check(): Promise<boolean> {
  if (!cached) {
    cached = (async () => {
      try {
        const db = createClient();
        const { data: { session } } = await db.auth.getSession();
        if (!session) return false;
        const { data } = await db.rpc("is_admin");
        return data === true;
      } catch {
        return false;
      }
    })();
  }
  return cached;
}

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let off = false;
    void check().then((v) => { if (!off) setIsAdmin(v); });
    // 로그인·로그아웃하면 다시 확인해요.
    const { data: { subscription } } = createClient().auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") {
        cached = null;
        void check().then((v) => { if (!off) setIsAdmin(v); });
      }
    });
    return () => { off = true; subscription.unsubscribe(); };
  }, []);
  return isAdmin;
}
