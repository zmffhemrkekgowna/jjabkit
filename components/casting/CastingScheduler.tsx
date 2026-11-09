"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, firstSession, fmtDate, fromKey, lastSession, matches, nextSession, weekStart, type ShowIndex } from "@/lib/casting";
import { todayKST } from "@/lib/period";
import { nowKST } from "@/lib/home";
import { useTodayKST } from "@/lib/useToday";
import CastFilter from "./CastFilter";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayPanel from "./DayPanel";
import ShareBar from "../ShareBar";
import { castingSpec } from "@/lib/calendarImage";
import type { EventItem } from "@/types/event";
import { displayEvents } from "@/lib/eventScope";

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
  const [selDate, setSelDate] = useState(""); // 월간 달력에서 고른 날짜(그날의 회차를 달력 옆·아래에 크게 보여줘요)
  // 오늘(한국 시간)은 서버와 브라우저가 달라 렌더 중에 계산하면 어긋날 수 있어서 마운트 후에 정해지고(첫 값 ""), 자정이 지나면 바뀌어요.
  const today = useTodayKST("");
  // 달력 막대: 전체 회차는 첫~마지막 회차 날짜, 특정 회차는 고른 날짜(이어진 날짜끼리 한 막대), 기간은 그대로. 날짜별 칩·회차별 배지는 원래 이벤트(events)로 판단해요.
  const barEvents = useMemo(() => displayEvents(events, [...idx.byDate.keys()]), [events, idx]);

  useEffect(() => {
    const t = fromKey(todayKST());
    setCursor(t < idx.start ? idx.start : t > idx.end ? idx.end : t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setSelDate((d) => (d && fromKey(d).getFullYear() === cursor.getFullYear() && fromKey(d).getMonth() === cursor.getMonth() ? d : "")); }, [cursor]);
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
  const goDate = (key: string) => { setCursor(fromKey(key)); setSelDate(key); };
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
  const seg = (on: boolean) => `min-h-[36px] rounded-md px-2.5 py-1 min-[360px]:px-3 text-sm ${on ? "bg-ink text-bg" : "text-mute"}`;

  return (
    <>
      <CastFilter idx={idx} sel={sel} toggle={toggle} selectMany={selectMany} reset={reset} only={only} setOnly={setOnly} hits={hits} />
      <div className="flex flex-wrap items-center justify-between gap-y-1">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} disabled={!canPrev} aria-label="이전" className="grid h-11 w-11 place-items-center rounded-lg disabled:opacity-30"><ChevronLeft size={18} aria-hidden /></button>
          <h2 className="min-w-[7rem] text-center font-bold min-[360px]:min-w-[8rem]">{title}</h2>
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

      {filtering && (
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-mute" aria-label="달력 표시 설명">
          <span className="inline-flex items-center gap-1"><span aria-hidden className="inline-block h-3 w-3 rounded-sm bg-brand" />선택한 배우가 나오는 회차</span>
        </p>
      )}

      {view === "month" ? (
        <div className="space-y-3 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-4 lg:space-y-0">
          <MonthView color={color} idx={idx} cursor={cursor} sel={sel} only={only} today={today} events={barEvents} onOpen={(d, sid) => { setSelDate(d); onOpen(d, sid); }} onOpenEvent={onOpenEvent} selected={selDate} onSelectDate={setSelDate} />
          <div className="lg:sticky lg:top-24">
            {selDate
              ? <DayPanel idx={idx} date={selDate} sel={sel} only={only} events={events} onOpen={onOpen} onOpenEvent={onOpenEvent} />
              : <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-sm text-mute">달력에서 날짜를 누르면 그날의 회차와 출연진이 여기에 크게 보여요.</p>}
          </div>
        </div>
      ) : <WeekView idx={idx} cursor={cursor} sel={sel} only={only} onOpen={onOpen} />}

    </>
  );
}
