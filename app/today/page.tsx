import type { Metadata } from "next";
import TodayView from "@/components/TodayView";
import { fetchShows } from "@/lib/db/shows";
import { fetchEventsSafe } from "@/lib/db/events";
import { readPublic } from "@/lib/supabase/public";
import { todayKST } from "@/lib/period";
import { usableEvent } from "@/lib/eventScope";

// 캐시해 두고 재사용해요. 관리자가 저장하면 바로 새로 만들어요. 날짜는 화면(브라우저)이 한국 시간 기준으로 다시 맞춰요(useTodayKST).
export const revalidate = 300;
export const metadata: Metadata = { title: "오늘의 공연 · JJabKit" };

export default async function TodayPage() {
  const shows = await readPublic(fetchShows, []);
  // 이벤트는 덧붙여 보여 주는 정보예요. 불러오지 못해도 공연·캐스트 화면은 그대로 떠야 해요.
  const events = await readPublic(fetchEventsSafe, []).then((l) => l.filter(usableEvent)).catch(() => []);
  return <TodayView shows={shows} events={events} serverToday={todayKST()} />;
}
