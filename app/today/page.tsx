import type { Metadata } from "next";
import TodayView from "@/components/TodayView";
import { fetchShows } from "@/lib/db/shows";
import { fetchEventsSafe } from "@/lib/db/events";
import { createClient } from "@/lib/supabase/server";
import { todayKST } from "@/lib/period";
import { usableEvent } from "@/lib/eventScope";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "오늘의 공연 · JJabKit" };

export default async function TodayPage() {
  const db = await createClient();
  const shows = await fetchShows(db);
  // 이벤트는 덧붙여 보여 주는 정보예요. 불러오지 못해도 공연·캐스트 화면은 그대로 떠야 해요.
  const events = await fetchEventsSafe(db).then((l) => l.filter(usableEvent)).catch(() => []);
  return <TodayView shows={shows} events={events} serverToday={todayKST()} />;
}
