"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { ADSENSE_CLIENT, isValidClient } from "@/lib/ads";

/**
 * 애드센스 스크립트(adsbygoogle.js)를 한 번만 불러와요.
 * 관리자·로그인 화면에서는 불러오지 않아요. ID가 없거나 형식이 틀리면 아무것도 안 해요.
 */
export default function AdSenseScript() {
  const path = usePathname() ?? "";
  if (!isValidClient(ADSENSE_CLIENT) || path.startsWith("/admin")) return null;
  return (
    <Script
      id="adsense-loader"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  );
}
