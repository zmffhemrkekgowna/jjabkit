"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { classifyPath, isBotUserAgent } from "@/lib/pageviews";

/**
 * 익명 페이지뷰 신호. 화면이 바뀔 때 페이지 유형(+공연 ID)만 Supabase에 바로 기록해요.
 * Vercel 서버(/api/pv)를 거치지 않아서 방문할 때마다 Vercel CPU를 쓰지 않아요.
 * 봇 걸러내기는 브라우저에서 하고, 관리자 접속은 예전처럼 DB 함수(record_pageview의 is_admin())가 걸러요.
 * 쿠키·localStorage·기기 식별값을 만들거나 읽지 않고, 실패해도 조용히 넘어가요.
 * 같은 주소를 1.5초 안에 다시 보내지는 않아요(개발 모드의 이중 실행·연타 방지). 새로고침·재방문은 각각 1회예요.
 */
let lastPath = "";
let lastAt = 0;

export default function PageViewBeacon({ skip = false }: { skip?: boolean }) {
  const pathname = usePathname();
  useEffect(() => {
    if (skip || !pathname || pathname.startsWith("/admin")) return;
    const now = Date.now();
    if (pathname === lastPath && now - lastAt < 1500) return;
    lastPath = pathname; lastAt = now;
    // 첫 화면 표시를 방해하지 않도록 브라우저가 한가할 때 보내요.
    const send = () => {
      try {
        if (isBotUserAgent(navigator.userAgent) || (navigator as Navigator & { webdriver?: boolean }).webdriver) return;
        const hit = classifyPath(pathname);
        if (!hit) return;
        void createClient().rpc("record_pageview", { p_type: hit.type, p_show_id: hit.showId }).then(() => {}, () => {});
      } catch { /* 통계 실패는 사이트 이용에 영향을 주지 않아요 */ }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(send, { timeout: 2000 }); else setTimeout(send, 300);
  }, [pathname, skip]);
  return null;
}
