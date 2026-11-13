"use client";

import { useMemo, useRef } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Show } from "@/types/show";
import type { EventItem } from "@/types/event";
import { isHttpUrl } from "@/lib/period";
import { fmtDate, fromKey } from "@/lib/casting";
import { useTodayKST } from "@/lib/useToday";
import { useMySched } from "@/lib/mySched";
import { useFavorites } from "@/lib/favorites";
import { eventsForSession } from "@/lib/eventScope";
import { NO_CAST, castNames, groupByDate, groupByTime, shiftDate, validDate } from "@/lib/today";
import { readableText } from "@/lib/color";
import { showColor } from "@/lib/mySchedule";
import UserDataSync from "./UserDataSync";
import HomeTabs from "./HomeTabs";
import AdSenseBanner from "./ads/AdSenseBanner";
import { ADSENSE_SLOT_LIST } from "@/lib/ads";

/** 오늘 탭: 고른 날짜(기본은 오늘)에 열리는 공연을 회차별 캐스트와 함께 보여 줘요. */
export default function TodayView({ shows, events = [], serverToday }: { shows: Show[]; events?: EventItem[]; serverToday: string }) {
  // 날짜의 기준은 주소(?d=)예요. 그래서 새로고침·공유·뒤로/앞으로 가기가 모두 같은 날짜를 보여 줘요.
  const q = useSearchParams().get("d");
  const picked = validDate(q) ? q : null;
  const today = useTodayKST(serverToday); // 한국 시간 기준, 자정이 지나면 바뀌어요
  const date = picked ?? today; // 주소에 날짜가 없으면 '오늘'을 따라가요(자정이 지나면 같이 넘어가요)
  const lastPush = useRef(0);
  const pick = (v: string) => {
    if (!validDate(v) || v === date) return;
    const url = v === today ? "/today" : `/today?d=${v}`;
    // 이전/다음 버튼을 연달아 눌러도 기록이 한 칸만 쌓이게, 1.2초 안의 연속 이동은 같은 칸을 덮어써요.
    const quick = Date.now() - lastPush.current < 1200;
    lastPush.current = Date.now();
    try { if (quick) window.history.replaceState(null, "", url); else window.history.pushState(null, "", url); } catch { /* 주소 갱신 실패는 무시 */ }
  };
  const groups = useMemo(() => groupByDate(shows, date), [shows, date]);
  const slots = useMemo(() => groupByTime(groups), [groups]);
  const mine = useMySched();
  const fav = useFavorites();
  const sessionCount = slots.reduce((n, sl) => n + sl.rows.length, 0);
  const d = fromKey(date);

  return (
    <div className="mx-auto max-w-3xl pb-10 lg:max-w-5xl">
      <UserDataSync shows={shows} />
      <header className="sticky top-11 z-30 border-b border-line bg-bg">
        <HomeTabs active="today" />
        <div className="px-4 py-3">
        <h1 className="font-serif text-xl font-bold">{date === today ? "오늘의 공연" : "공연 일정"}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="날짜 선택">
          <button onClick={() => pick(shiftDate(date, -1))} aria-label="전날" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line hover:border-brand"><ChevronLeft size={16} aria-hidden /></button>
          <input type="date" value={date} onChange={(e) => pick(e.target.value)} aria-label="날짜" className="h-11 rounded-lg border border-line bg-card px-3 text-sm" />
          <button onClick={() => pick(shiftDate(date, 1))} aria-label="다음날" className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line hover:border-brand"><ChevronRight size={16} aria-hidden /></button>
          {date !== today && <button onClick={() => pick(today)} className="inline-flex h-11 items-center rounded-lg border border-brand px-3 text-sm font-bold text-brand">오늘로</button>}
        </div>
        </div>
      </header>

      <main className="px-4 pt-4">
        <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-base font-bold">{fmtDate(d)}</h2>
          {groups.length > 0 && <p aria-live="polite" className="text-sm text-mute">공연 {groups.length}개 · 총 {sessionCount}회차</p>}
        </div>
        {groups.length > 0 ? (
          <div aria-label="공연 목록" role="group" className="space-y-6">
            {slots.map(({ time, rows }) => (
              <section key={time} aria-label={`${time} 공연`}>
                <p className="mb-2 flex items-baseline gap-2 text-xl font-medium tabular-nums">{time}</p>
                <ul className="border border-line bg-card">
                  {rows.map(({ show, session: s }) => {
                    const evs = eventsForSession(events, show.id, date, s.time); // 이 공연의 이 회차(날짜+시간)에 실제로 적용되는 이벤트만(여러 개면 모두)
                    const names = castNames(show, s);
                    const bg = showColor(show);
                    const isFavShow = fav.ready && fav.shows.has(show.id);
                    const isMine = mine.ready && mine.has(s.id);
                    return (
                      <li key={s.id} className="relative flex border-b border-line last:border-b-0 hover:bg-hit">
                        {/* 줄 전체를 누르면 회차 상세로. 이벤트 배지(링크)만 그 위에서 따로 눌려요. */}
                        <Link href={`/shows/${show.id}?d=${s.date}&s=${s.id}`} aria-label={`${show.title} ${s.time} 회차 상세`} className="absolute inset-0" />
                        {/* 왼쪽 열: 공연명(가로·세로 가운데). 폭은 화면의 약 30%, 좁은 화면에서도 너무 좁아지지 않게 하한을 둬요. 높이는 오른쪽과 같이 늘어나요. */}
                        <div className="pointer-events-none flex w-[30%] min-w-[6.5rem] max-w-[13rem] shrink-0 items-center justify-center px-2.5 py-2.5 text-center sm:px-3" style={{ backgroundColor: bg, color: readableText(bg) }}>
                          <h3 className="min-w-0 break-keep text-[15px] font-medium leading-snug [overflow-wrap:anywhere]">{show.title}</h3>
                        </div>
                        {/* 오른쪽 열: 이벤트 배지 → 배우 이름 순으로 한 흐름에서 줄바꿈돼요. */}
                        <div className="pointer-events-none flex min-w-0 flex-1 items-center px-3 py-2">
                          <p className={`min-w-0 flex-1 text-left text-sm leading-6 [overflow-wrap:anywhere] ${names.length ? "" : "text-mute"}`}>
                            {evs.map((e) => {
                              const cls = "mr-1.5 my-0.5 inline-block max-w-full break-words rounded bg-hit px-2 py-0.5 align-baseline text-[13px] font-medium leading-snug text-brand";
                              return isHttpUrl(e.linkUrl)
                                ? <a key={e.id} href={e.linkUrl} target="_blank" rel="noopener noreferrer" title="이벤트 공지 보기 (새 탭)" className={`${cls} pointer-events-auto relative z-10 underline-offset-2 hover:underline`}>{e.title}</a>
                                : <span key={e.id} className={cls}>{e.title}</span>;
                            })}
                            {/* 배우 이름은 이름 단위로만 줄바꿈해요(이름 중간에서 끊기지 않게). */}
                            <span>{names.length ? names.map((n, i) => (<span key={n + i}><span className="whitespace-nowrap">{fav.ready && fav.actors.has(n) ? <b className="text-brand">♥ {n}</b> : n}{i < names.length - 1 && ","}</span>{" "}</span>)) : NO_CAST}</span>
                            {isFavShow && <span className="ml-1.5 inline-block rounded border border-brand px-1.5 py-0.5 align-baseline text-xs font-bold leading-none text-brand">관심 공연</span>}
                            {isMine && <span className="ml-1.5 inline-block rounded bg-hit px-1.5 py-0.5 align-baseline text-xs font-bold leading-none text-brand">내 일정</span>}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-line bg-card p-8 text-center">
            <p className="text-sm text-mute">{shows.length === 0 ? "아직 등록된 공연이 없어요." : "이 날은 열리는 공연이 없어요. 다른 날짜를 골라 보세요."}</p>
          </div>
        )}
        <div className="pt-6"><AdSenseBanner slot={ADSENSE_SLOT_LIST} label="오늘 탭 하단 광고" /></div>
      </main>
    </div>
  );
}
