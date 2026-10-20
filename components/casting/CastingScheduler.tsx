"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import { addDays, matches, toKey, weekStart, type ShowIndex } from "@/lib/casting";
import CastFilter from "./CastFilter";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import ShareBar from "../ShareBar";
import { castingSpec } from "@/lib/calendarImage";

interface Props {
  showTitle: string;
  idx: ShowIndex; sel: Set<string>; only: boolean; setOnly: (v: boolean) => void;
  toggle: (id: string) => void; selectMany: (ids: string[]) => void; reset: () => void; onOpen: (date: string, sid?: string) => void;
}

export default function CastingScheduler({ showTitle, idx, sel, only, setOnly, toggle, selectMany, reset, onOpen }: Props) {
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<Date>(idx.start);
  const [today, setToday] = useState("");

  // 오늘 날짜는 서버와 브라우저의 시간대가 달라 렌더 중에 계산하면 화면이 어긋날 수 있어서, 마운트 후에 정해요.
  useEffect(() => {
    const t = new Date();
    setToday(toKey(t));
    setCursor(t < idx.start ? idx.start : t > idx.end ? idx.end : t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hits = idx.sessions.filter((s) => matches(idx, s, sel)).length;
  const clamp = (d: Date) => (d < idx.start ? idx.start : d > idx.end ? idx.end : d);
  const step = (dir: -1 | 1) =>
    setCursor((c) => clamp(view === "month" ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, 7 * dir)));
  const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
  const canPrev = view === "month" ? !sameMonth(cursor, idx.start) : weekStart(cursor) > weekStart(idx.start);
  const canNext = view === "month" ? !sameMonth(cursor, idx.end) : weekStart(cursor) < weekStart(idx.end);
  const ws = weekStart(cursor), we = addDays(ws, 6);
  const title = view === "month" ? `${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월` : `${ws.getMonth() + 1}/${ws.getDate()} ~ ${we.getMonth() + 1}/${we.getDate()}`;
  const seg = (on: boolean) => `rounded-md px-3 py-1 text-sm ${on ? "bg-ink text-bg" : "text-mute"}`;

  return (
    <>
      <CastFilter idx={idx} sel={sel} toggle={toggle} selectMany={selectMany} reset={reset} only={only} setOnly={setOnly} hits={hits} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} disabled={!canPrev} aria-label="이전" className="rounded-lg p-2 disabled:opacity-30"><ChevronLeft size={18} aria-hidden /></button>
          <h2 className="min-w-[8rem] text-center font-bold">{title}</h2>
          <button onClick={() => step(1)} disabled={!canNext} aria-label="다음" className="rounded-lg p-2 disabled:opacity-30"><ChevronRight size={18} aria-hidden /></button>
        </div>
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="보기 방식">
          <button aria-pressed={view === "month"} onClick={() => setView("month")} className={seg(view === "month")}>월간</button>
          <button aria-pressed={view === "week"} onClick={() => setView("week")} className={seg(view === "week")}>주간</button>
        </div>
      </div>

      <ShareBar
        build={() => castingSpec(showTitle, idx, cursor, sel, only)}
        fileBase={`${showTitle}-${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`}
        shareTitle={`${showTitle} 캐스팅`} shareText={`${showTitle} ${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월 캐스팅 스케줄`} withUrl
      />

      {view === "month"
        ? <MonthView idx={idx} cursor={cursor} sel={sel} only={only} today={today} onOpen={onOpen} />
        : <WeekView idx={idx} cursor={cursor} sel={sel} only={only} onOpen={onOpen} />}

      <p className="flex items-center gap-1.5 text-xs text-mute">
        <span className="text-gold"><Star size={12} aria-hidden /></span>
        별은 커튼콜 데이, %는 타임세일 회차예요. 회차 태그를 누르면 전체 출연진과 예매처가 열려요.
      </p>
    </>
  );
}
