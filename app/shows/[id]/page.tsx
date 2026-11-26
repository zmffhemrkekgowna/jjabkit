import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ShowDetail from "@/components/ShowDetail";
import { fetchShow } from "@/lib/db/shows";
import { fetchEventsSafe } from "@/lib/db/events";
import { readPublic } from "@/lib/supabase/public";
import { showMetadata } from "@/lib/shareMeta";
import { usableEvent } from "@/lib/eventScope";

// 공연별로 처음 열릴 때 만들어 두고 재사용해요. 관리자가 저장하면 바로 새로 만들어요(/api/revalidate). lib/cachePolicy.ts 참고
export const revalidate = 300;

/** 미리 만들어 두는 주소는 없고, 처음 열릴 때 만들어 캐시해요(이게 있어야 주소별 캐시가 켜져요). */
export function generateStaticParams() { return []; }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 같은 요청 안에서 공연을 한 번만 불러와요(화면과 링크 미리보기가 함께 써요). */
const getShow = cache(async (id: string) => readPublic((db) => fetchShow(db, id), null));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!UUID.test(id)) return {};
  try { const show = await getShow(id); return show ? showMetadata(show) : {}; } catch { return {}; } // 실패해도 화면은 떠야 해요
}

/**
 * 오늘 탭 등에서 온 회차 링크(?d=날짜&s=회차id)는 화면(ShowDetail)이 브라우저에서 읽어 그 회차 상세를 열어요.
 * (서버가 주소 뒤 값을 읽으면 캐시를 못 해서, 이 부분만 브라우저로 옮겼어요)
 */
export default async function ShowPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const [show, events] = await Promise.all([getShow(id), readPublic(fetchEventsSafe, [])]);
  if (!show) notFound();
  // 이 공연에 연결된 이벤트만, 시작하는 날 순서로
  const mine = events.filter((e) => e.showId === id && usableEvent(e)).sort((a, b) => (a.startsOn || "").localeCompare(b.startsOn || "") || a.createdAt.localeCompare(b.createdAt));
  return <ShowDetail show={show} events={mine} />;
}
