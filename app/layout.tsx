import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import ModeBar from "@/components/ModeBar";
import AdSenseScript from "@/components/ads/AdSenseScript";
import SponsorPopup from "@/components/ads/SponsorPopup";
import BottomNav from "@/components/BottomNav";
import { FavoritesProvider } from "@/lib/favorites";
import { getAuthState } from "@/lib/auth";
import { fetchNoticesSafe } from "@/lib/db/notices";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "뮤킷 Myukit", description: "뮤지컬·연극 캐스팅 스케줄" };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { isAdmin } = await getAuthState();
  // 소식을 못 불러와도(환경변수 누락, 0003 미적용 등) 전체 화면은 그대로 떠야 해요.
  const notices = await createClient().then(fetchNoticesSafe).catch(() => []);
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
          <ModeBar isAdmin={isAdmin} notices={notices} />
          {children}
          <SponsorPopup />
          <BottomNav />
        </FavoritesProvider>
        <AdSenseScript />
      </body>
    </html>
  );
}
