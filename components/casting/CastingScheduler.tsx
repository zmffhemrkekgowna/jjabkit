"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, firstSession, fmtDate, fromKey, lastSession, matches, nextSession, weekStart, type ShowIndex } from "@/lib/casting";
import { todayKST } from "@/lib/period";
import { nowKST } from "@/lib/home";
import { useTodayKST } from "@/lib/useToday";
import CastFilter from "./CastFilter";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import ShareBar from "../ShareBar";
import { castingSpec } from "@/lib/calendarImage";
import type { EventItem } from "@/types/event";

interface Props {
  showTitle: string;
  idx: ShowIndex; sel: Set<string>; only: boolean; setOnly: (v: boolean) => void;
  toggle: (id: string) => void; selectMany: (ids: string[]) => void; reset: () => void; onOpen: (date: string, sid?: string) => void;
  events?: EventItem[]; onOpenEvent?: (e: EventItem) => void;
  /** 공연별 스케줄 색(달력 카드·PNG에 써요) */
  color?: string;
}

export default function CastingScheduler({ showTitle, idx, sel, only, setOnly, toggle, selectMany, reset, onOpen, events = [], onOpenEvent, color }: Props) {
  const [view, setView] = useState<"month" | "week">("month");
  const [cursor, setCursor] = useState<Date>(idx.start);
  const [note, setNote] = useState("");
  // 오늘(한국 시간)은 서버와 브라우저가 달라 렌더 중에 계산하면 어긋날 수 있어서 마운트 후에 정해지고(첫 값 ""), 자정이 지나면 바뀌어요.
  const today = useTodayKST("");

  useEffect(() => {
    const t = fromKey(todayKST());
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
  // 빠른 이동. 필터를 골랐다면 그 조건에 맞는 회차만 대상으로 해요.
  const filtering = sel.size > 0;
  const goDate = (key: string) => { setCursor(fromKey(key)); };
  const goToday = () => {
    const t = fromKey(todayKST());
    setCursor(clamp(t));
    setNote(t < idx.start || t > idx.end ? "오늘은 공연 기간이 아니에요. 가장 가까운 날짜로 이동했어요." : "");
  };
  const goNext = () => {
    const s = nextSession(idx, nowKST(), sel);
    if (!s) { setNote(filtering ? "선택한 배우가 나오는 앞으로의 회차가 없어요." : "앞으로 예정된 회차가 없어요."); return; }
    setNote(""); goDate(s.date); onOpen(s.date, s.id);
  };
  const goEdge = (which: "first" | "last") => {
    const s = which === "first" ? firstSession(idx, sel) : lastSession(idx, sel);
    if (!s) { setNote(idx.sessions.length === 0 ? "등록된 회차가 아직 없어요." : "선택한 배우가 나오는 회차가 없어요."); return; }
    setNote(`${which === "first" ? "첫" : "마지막"} 회차: ${fmtDate(fromKey(s.date))} ${s.time}`); goDate(s.date);
  };
  const seg = (on: boolean) => `min-h-[36px] rounded-md px-3 py-1 text-sm ${on ? "bg-ink text-bg" : "text-mute"}`;

  return (
    <>
      <CastFilter idx={idx} sel={sel} toggle={toggle} selectMany={selectMany} reset={reset} only={only} setOnly={setOnly} hits={hits} />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} disabled={!canPrev} aria-label="이전" className="grid h-11 w-11 place-items-center rounded-lg disabled:opacity-30"><ChevronLeft size={18} aria-hidden /></button>
          <h2 className="min-w-[8rem] text-center font-bold">{title}</h2>
          <button onClick={() => step(1)} disabled={!canNext} aria-label="다음" className="grid h-11 w-11 place-items-center rounded-lg disabled:opacity-30"><ChevronRight size={18} aria-hidden /></button>
        </div>
        <div className="inline-flex rounded-lg border border-line p-0.5" role="group" aria-label="보기 방식">
          <button aria-pressed={view === "month"} onClick={() => setView("month")} className={seg(view === "month")}>월간</button>
          <button aria-pressed={view === "week"} onClick={() => setView("week")} className={seg(view === "week")}>주간</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="빠른 이동">
        <button onClick={goToday} className="min-h-[44px] rounded-lg border border-brand px-4 text-sm font-bold text-brand">오늘</button>
        <button onClick={goNext} disabled={idx.sessions.length === 0} className="min-h-[44px] rounded-lg border border-brand bg-brand px-4 text-sm font-bold text-onbrand disabled:opacity-40">{filtering ? "다음 출연 회차" : "다음 회차"}</button>
        <button onClick={() => goEdge("first")} disabled={idx.sessions.length === 0} className="min-h-[44px] rounded-lg px-2 text-sm text-mute underline disabled:opacity-40">첫 회차</button>
        <button onClick={() => goEdge("last")} disabled={idx.sessions.length === 0} className="min-h-[44px] rounded-lg px-2 text-sm text-mute underline disabled:opacity-40">마지막 회차</button>
      </div>
      <p role="status" aria-live="polite" className={note ? "text-sm text-mute" : "sr-only"}>{note}</p>
      {idx.sessions.length === 0 && <p className="rounded-xl border border-line bg-card p-3 text-sm text-mute">아직 등록된 회차가 없어요. 회차가 올라오면 여기서 캐스팅을 볼 수 있어요.</p>}

      <ShareBar
        build={() => castingSpec(showTitle, idx, cursor, sel, only, color)}
        fileBase={`${showTitle}-${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`}
        shareTitle={`${showTitle} 캐스팅`} shareText={`${showTitle} ${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월 캐스팅 스케줄`} withUrl
      />

      {view === "month"
        ? <MonthView color={color} idx={idx} cursor={cursor} sel={sel} only={only} today={today} events={events} onOpen={onOpen} onOpenEvent={onOpenEvent} />
        : <WeekView idx={idx} cursor={cursor} sel={sel} only={only} onOpen={onOpen} />}

    </>
  );
}
