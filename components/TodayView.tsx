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
import { NO_CAST, castNames, eventsOnDate, groupByDate, groupByTime, shiftDate, validDate } from "@/lib/today";
import { readableText } from "@/lib/color";
import { showColor } from "@/lib/mySchedule";
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
  const d = fromKey(date);

  return (
    <div className="mx-auto max-w-3xl pb-10">
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
        <h2 className="mb-2 text-base font-bold">{fmtDate(d)}</h2>
        {groups.length > 0 ? (
          <div aria-label="공연 목록" role="group" className="space-y-5">
            {slots.map(({ time, rows }) => (
              <section key={time} aria-label={`${time} 공연`}>
                <p className="mb-1.5 text-xl font-medium tabular-nums">{time}</p>
                <ul className="border border-line bg-card">
                  {rows.map(({ show, session: s }) => {
                    const evs = eventsOnDate(events, show.id, date); // 이 공연·이 날짜에 적용되는 이벤트(관리자가 등록한 것)
                    const names = castNames(show, s);
                    const bg = showColor(show);
                    return (
                      <li key={s.id} className="relative flex min-h-[3.5rem] border-b border-line last:border-b-0 hover:bg-hit">
                        {/* 줄 전체를 누르면 회차 상세로. 이벤트 배지(링크)만 그 위에서 따로 눌려요. */}
                        <Link href={`/shows/${show.id}?d=${s.date}&s=${s.id}`} aria-label={`${show.title} ${s.time} 회차 상세`} className="absolute inset-0" />
                        <div className="pointer-events-none flex w-[32%] min-w-[6.25rem] max-w-[13rem] shrink-0 items-center px-3 py-2.5" style={{ backgroundColor: bg, color: readableText(bg) }}>
                          <h3 className="break-keep text-[15px] font-medium leading-snug">{show.title}{show.genre !== "뮤지컬" && <span className="ml-1 whitespace-nowrap text-xs font-normal opacity-80">- {show.genre}</span>}</h3>
                        </div>
                        <div className="pointer-events-none flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5">
                          <p className={`min-w-0 flex-1 break-words text-sm leading-relaxed ${names.length ? "" : "text-mute"}`}>
                            {evs.map((e) => {
                              const cls = "mr-1.5 inline-block max-w-full break-words rounded-md bg-hit px-2 py-0.5 align-baseline text-[13px] font-medium leading-snug text-brand";
                              return isHttpUrl(e.linkUrl)
                                ? <a key={e.id} href={e.linkUrl} target="_blank" rel="noopener noreferrer" title="이벤트 공지 보기 (새 탭)" className={`${cls} pointer-events-auto relative z-10 underline-offset-2 hover:underline`}>{e.title}</a>
                                : <span key={e.id} className={cls}>{e.title}</span>;
                            })}
                            <span>{names.length ? names.join(", ") : NO_CAST}</span>
                          </p>
                          {mine.ready && mine.has(s.id) && <span className="shrink-0 rounded-full bg-hit px-2 py-0.5 text-xs font-bold text-brand">내 일정</span>}
                          <ChevronRight size={16} className="shrink-0 text-mute" aria-hidden />
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
