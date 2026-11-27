import type { Metadata } from "next";
import { InfoView } from "@/components/InfoPage";
import { fetchPagesSafe } from "@/lib/db/pages";
import { createPublicClient } from "@/lib/supabase/public";
import { PAGE_DEFAULTS } from "@/lib/pageDefaults";

export const metadata: Metadata = {
  title: `${PAGE_DEFAULTS.about.title} - JJabKit`,
  description: "JJabKit(짭킷)은 뮤지컬·연극·콘서트의 회차별 캐스팅을 달력으로 확인하고, 관심 배우 일정과 관극 기록·통계를 관리하는 공연 팬 서비스예요.",
};

// 캐시해 두고 재사용해요. 관리자 화면에서 문구를 고치면 바로 새로 만들어요(/api/revalidate). lib/cachePolicy.ts 참고
export const revalidate = 86400;

/**
 * 소개 페이지. 검색엔진·광고 심사 로봇이 처음 받는 HTML에 본문이 바로 들어가도록,
 * 미리 만들어 둔(캐시된) 화면을 그대로 보내요('불러오는 중…' 화면이 먼저 나가지 않게).
 */
export default async function Page() {
  const page = (await fetchPagesSafe(createPublicClient())).about;
  return <InfoView title={page.title} body={page.body} updatedAt={page.updatedAt} back={{ href: "/guide", label: "이용 안내" }} />;
}
