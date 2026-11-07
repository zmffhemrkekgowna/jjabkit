import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import ModeBar from "@/components/ModeBar";
import AdSenseScript from "@/components/ads/AdSenseScript";
import SponsorPopup from "@/components/ads/SponsorPopup";
import BottomNav from "@/components/BottomNav";
import PageViewBeacon from "@/components/PageViewBeacon";
import SiteFooter from "@/components/SiteFooter";
import { FavoritesProvider } from "@/lib/favorites";
import { MySchedProvider } from "@/lib/mySched";
import { getAuthState } from "@/lib/auth";
import { fetchNoticesSafe } from "@/lib/db/notices";
import { fetchPopupsSafe } from "@/lib/db/popups";
import { phaseOf } from "@/lib/period";
import { createClient } from "@/lib/supabase/server";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { metadataBase: siteUrl(), title: "JJabKit - 짭킷", description: "뮤지컬·연극 캐스팅 스케줄", openGraph: { title: "JJabKit - 짭킷", description: "뮤지컬·연극 캐스팅 스케줄", siteName: "JJabKit", type: "website" } };

/** 소식·팝업은 보조 정보라서 조회가 실패해도 사이트 전체를 막지 않아요. 대신 서버 로그에 남겨요(DbError가 이미 남겨요). */
const softFail = <T,>(fallback: T) => (e: unknown) => { console.error("[layout] 보조 데이터 조회 실패:", e instanceof Error ? e.message : e); return fallback; };

export default async function RootLayout({ children }: { children: ReactNode }) {
  // 로그인 확인·소식·팝업은 서로 상관없어서 동시에 불러와요(순서대로 기다리면 그만큼 느려져요).
  // 소식을 못 불러와도(환경변수 누락, 0003 미적용 등) 전체 화면은 그대로 떠야 해요.
  const db = await createClient().catch(() => null);
  const [{ isAdmin }, notices, allPopups] = await Promise.all([
    getAuthState(),
    db ? fetchNoticesSafe(db).catch(softFail([])) : Promise.resolve([]),
    db ? fetchPopupsSafe(db).catch(softFail([])) : Promise.resolve([]),
  ]);
  // 팝업: 켜 둔 것 중 오늘이 기간 안인 것만. (관리자는 꺼 둔 것도 읽히니 여기서 한 번 더 거르는 거예요)
  const popups = allPopups.filter((p) => p.active && phaseOf(p) === "active");
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&family=Noto+Serif+KR:wght@700&display=swap" rel="stylesheet" />
        <script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('theme');if(t)document.documentElement.dataset.theme=t}catch(e){}" }} />
      </head>
      <body style={{ paddingBottom: "calc(3.5rem + env(safe-area-inset-bottom, 0px))" }}>
        <FavoritesProvider>
          <MySchedProvider>
          <ModeBar isAdmin={isAdmin} notices={notices} />
          {children}
          <SiteFooter />
          <SponsorPopup popups={popups} />
          <BottomNav />
          </MySchedProvider>
        </FavoritesProvider>
        <PageViewBeacon skip={isAdmin} />
        <AdSenseScript />
      </body>
    </html>
  );
}
