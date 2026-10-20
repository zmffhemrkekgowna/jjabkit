"use client";

import { useEffect, useRef } from "react";
import { ADSENSE_CLIENT, isValidClient, isValidSlot } from "@/lib/ads";

declare global {
  interface Window { adsbygoogle?: unknown[] }
}

type Props = {
  /** 애드센스 광고 단위 ID(숫자). 보통 환경변수 NEXT_PUBLIC_ADSENSE_SLOT_* 값을 넘겨요. */
  slot: string;
  /** 광고 자리 이름. 접근성 라벨과 자리표시자에 써요. */
  label?: string;
  className?: string;
};

/**
 * 반응형 애드센스 배너.
 * - ID가 설정되면 <ins class="adsbygoogle"> 를 그리고 push({}) 를 한 번만 호출해요.
 * - ID가 없으면, 개발 중에는 점선 자리표시자를 보여주고 운영(production)에서는 아무것도 안 그려요.
 * - 높이를 미리 잡아 두어서(min-h) 광고가 늦게 떠도 화면이 밀리지 않아요.
 */
export default function AdSenseBanner({ slot, label = "광고", className = "" }: Props) {
  const ready = isValidClient(ADSENSE_CLIENT) && isValidSlot(slot);
  const pushed = useRef(false);

  useEffect(() => {
    if (!ready || pushed.current) return; // 개발 모드의 이중 실행 등으로 두 번 push 하지 않게
    pushed.current = true;
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      /* 광고 차단기 등으로 실패해도 화면은 그대로 */
    }
  }, [ready]);

  if (!ready) {
    if (process.env.NODE_ENV === "production") return null;
    return (
      <aside aria-label={label} className={`flex min-h-[100px] flex-col items-center justify-center rounded-xl border border-dashed border-line bg-card text-center ${className}`}>
        <span className="text-[11px] font-medium text-mute">광고</span>
        <span className="mt-1 text-xs text-mute">애드센스 자리 · {label}</span>
        <code className="mt-1 text-[11px] text-mute">NEXT_PUBLIC_ADSENSE_CLIENT / SLOT 을 설정하면 광고가 나와요</code>
      </aside>
    );
  }

  return (
    <aside aria-label={label} className={`min-h-[100px] overflow-hidden ${className}`}>
      <p className="mb-1 text-[11px] text-mute">광고</p>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={slot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
