import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { InfoView } from "@/components/InfoPage";
import { fetchPagesSafe } from "@/lib/db/pages";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { PAGE_DEFAULTS } from "@/lib/pageDefaults";

export const metadata: Metadata = {
  title: `${PAGE_DEFAULTS.about.title} - JJabKit`,
  description: "JJabKit(짭킷)은 뮤지컬·연극·콘서트의 회차별 캐스팅을 달력으로 확인하고, 관심 배우 일정과 관극 기록·통계를 관리하는 공연 팬 서비스예요.",
};

/** 관리자가 고칠 수 있는 이 페이지 문구를 서버 데이터 캐시에 담아 둬요. 쿠키가 필요 없는 공개 읽기 전용 연결을 써요. */
const getAbout = unstable_cache(
  async () => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const db = url && key ? createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) : null;
    return (await fetchPagesSafe(db)).about;
  },
  ["site-page-about"],
  { revalidate: 60 },
);

/**
 * 소개 페이지. 검색엔진·광고 심사 로봇이 처음 받는 HTML에 본문이 바로 들어가도록,
 * 매번 DB를 기다리지 않고 캐시된 문구로 그려요('불러오는 중…' 화면이 먼저 나가지 않게).
 * 관리자 화면에서 문구를 고치면 1분 정도 뒤에 반영돼요.
 */
export default async function Page() {
  let page;
  try {
    page = await getAbout();
  } catch {
    // 캐시 읽기가 실패하면(빌드 중 DB 연결 불가 등) 예전과 같은 방식으로 요청마다 읽어요.
    const db = await createServerClient().catch(() => null);
    page = (await fetchPagesSafe(db)).about;
  }
  return <InfoView title={page.title} body={page.body} updatedAt={page.updatedAt} back={{ href: "/guide", label: "이용 안내" }} />;
}
