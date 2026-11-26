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
import { fetchNoticesSafe } from "@/lib/db/notices";
import { fetchPopupsSafe } from "@/lib/db/popups";
import { phaseOf } from "@/lib/period";
import { createPublicClient } from "@/lib/supabase/public";
import { siteUrl } from "@/lib/site";

export const metadata: Metadata = { metadataBase: siteUrl(), title: "JJabKit - 짭킷", description: "뮤지컬·연극·콘서트 캐스팅 스케줄", openGraph: { title: "JJabKit - 짭킷", description: "뮤지컬·연극 캐스팅 스케줄", siteName: "JJabKit", type: "website" } };

/** 소식·팝업은 보조 정보라서 조회가 실패해도 사이트 전체를 막지 않아요. 대신 서버 로그에 남겨요(DbError가 이미 남겨요). */
const softFail = <T,>(fallback: T) => (e: unknown) => { console.error("[layout] 보조 데이터 조회 실패:", e instanceof Error ? e.message : e); return fallback; };

// 사용자 화면은 캐시해 두고 재사용해요(관리자 저장 시 즉시 새로 만듦, 아니면 5분마다). lib/cachePolicy.ts 참고
export const revalidate = 300;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // 소식·팝업은 서로 상관없어서 동시에 불러와요(순서대로 기다리면 그만큼 느려져요).
  // 소식을 못 불러와도(환경변수 누락, 0003 미적용 등) 전체 화면은 그대로 떠야 해요.
  // 관리자 여부는 캐시를 위해 서버가 아니라 브라우저에서 확인해요(ModeBar). 관리자 접속은 통계 DB 함수가 따로 걸러요.
  const db = createPublicClient();
  const [notices, allPopups] = await Promise.all([
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
          <ModeBar notices={notices} />
          {children}
          <SiteFooter />
          <SponsorPopup popups={popups} />
          <BottomNav />
          </MySchedProvider>
        </FavoritesProvider>
        <PageViewBeacon />
        <AdSenseScript />
      </body>
    </html>
  );
}
