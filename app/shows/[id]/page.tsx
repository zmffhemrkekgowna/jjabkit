import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ShowDetail from "@/components/ShowDetail";
import { fetchShow } from "@/lib/db/shows";
import { fetchEventsSafe } from "@/lib/db/events";
import { withShowColor } from "@/lib/color";
import { createClient } from "@/lib/supabase/server";
import { showMetadata } from "@/lib/shareMeta";
import { validDate } from "@/lib/today";
import { usableEvent } from "@/lib/eventScope";

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 같은 요청 안에서 공연을 한 번만 불러와요(화면과 링크 미리보기가 함께 써요). */
const getShow = cache(async (id: string) => fetchShow(await createClient(), id));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return {};
  try { const show = await getShow(id); return show ? showMetadata(show) : {}; } catch { return {}; } // 실패해도 화면은 떠야 해요
}

export default async function ShowPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ d?: string | string[]; s?: string | string[] }> }) {
  const { id } = await params;
  const q = await searchParams;
  if (!UUID.test(id)) notFound();
  const db = await createClient();
  const [show, events] = await Promise.all([getShow(id), fetchEventsSafe(db)]);
  if (!show) notFound();
  // 이 공연에 연결된 이벤트만, 시작하는 날 순서로
  const mine = withShowColor(events.filter((e) => e.showId === id && usableEvent(e)), show).sort((a, b) => (a.startsOn || "").localeCompare(b.startsOn || "") || a.createdAt.localeCompare(b.createdAt));
  // 오늘 탭 등에서 온 회차 링크(?d=날짜&s=회차id): 그 회차 상세를 바로 열어요. 없는 회차면 무시해요.
  const d = Array.isArray(q.d) ? q.d[0] : q.d, sid = Array.isArray(q.s) ? q.s[0] : q.s;
  const hit = validDate(d) ? show.sessions.find((x) => x.date === d && (!sid || x.id === sid)) : undefined;
  return <ShowDetail show={show} events={mine} initialOpen={hit ? { date: hit.date, sid: hit.id } : null} />;
}
