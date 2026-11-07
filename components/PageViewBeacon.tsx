"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 익명 페이지뷰 신호. 화면이 바뀔 때 주소(경로)만 서버에 알려요.
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
        void fetch("/api/pv", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ p: pathname }), keepalive: true, credentials: "same-origin" }).catch(() => {});
      } catch { /* 통계 실패는 사이트 이용에 영향을 주지 않아요 */ }
    };
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(send, { timeout: 2000 }); else setTimeout(send, 300);
  }, [pathname, skip]);
  return null;
}
