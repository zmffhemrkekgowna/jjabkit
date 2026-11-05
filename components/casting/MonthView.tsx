"use client";

import { Star } from "lucide-react";
import { DOW, actorOf, addDays, fmtDate, matches, toKey, visibleOn, type ShowIndex } from "@/lib/casting";
import type { EventItem } from "@/types/event";
import { isHex6, readableOn } from "@/lib/color";

interface Props {
  idx: ShowIndex; cursor: Date; sel: Set<string>; only: boolean; today: string;
  events?: EventItem[];
  onOpen: (date: string, sid?: string) => void;
  onOpenEvent?: (e: EventItem) => void;
}

interface Bar { ev: EventItem; col: number; span: number; lane: number; contLeft: boolean; contRight: boolean }

/** 한 주(7칸) 안에서 이벤트 막대의 위치와 줄(lane)을 정해요. 달 밖의 날짜에는 막대를 그리지 않아요. */
export function weekBars(events: EventItem[], keys: string[], inMonth: boolean[]): { bars: Bar[]; lanes: number } {
  const raw: Omit<Bar, "lane">[] = [];
  for (const ev of events) {
    if (!ev.startsOn) continue;
    const s = ev.startsOn, e = ev.endsOn || ev.startsOn;
    const hit = keys.map((k, i) => (inMonth[i] && k >= s && k <= e ? i : -1)).filter((i) => i >= 0);
    if (hit.length === 0) continue;
    const col = hit[0], span = hit[hit.length - 1] - col + 1;
    raw.push({ ev, col, span, contLeft: s < keys[col], contRight: e > keys[col + span - 1] });
  }
  raw.sort((a, b) => a.col - b.col || b.span - a.span || a.ev.title.localeCompare(b.ev.title));
  const ends: number[] = [];
  const bars = raw.map((r) => {
    let lane = ends.findIndex((end) => end < r.col);
    if (lane < 0) { lane = ends.length; ends.push(0); }
    ends[lane] = r.col + r.span - 1;
    return { ...r, lane };
  });
  return { bars, lanes: ends.length };
}

export default function MonthView({ idx, cursor, sel, only, today, events = [], onOpen, onOpenEvent }: Props) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let d = addDays(first, -first.getDay()); d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div>
      <div role="grid" aria-label={`${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월 캐스팅 달력`} className="overflow-hidden rounded-2xl border border-line bg-card">
        {/* 7요일이 화면 너비에 딱 맞게 들어가요. 이벤트는 날짜 아래에 기간만큼 길게 이어진 막대로 보여요. */}
        <div className="grid grid-cols-7 py-2 text-center text-xs text-mute">
          {DOW.map((w, i) => <div key={w} className={i === 0 ? "text-brand" : ""}>{w}</div>)}
        </div>
        <div className="space-y-px border-t border-line bg-line [--lane:1.25rem] sm:[--lane:1.5rem]">
          {weeks.map((week) => {
            const keys = week.map(toKey);
            const inMonth = week.map((d) => d.getMonth() === cursor.getMonth());
            const { bars, lanes } = weekBars(events, keys, inMonth);
            return (
              <div key={keys[0]} role="row" className="relative">
                <div className="grid grid-cols-7 gap-px bg-line">
                  {week.map((day, i) => {
                    const k = keys[i];
                    const list = inMonth[i] ? visibleOn(idx, k, sel, only) : [];
                    const hit = sel.size > 0 ? list.filter((s) => matches(idx, s, sel)).length : 0;
                    const isToday = k === today;
                    const dateCls = !inMonth[i] ? "opacity-30" : day.getDay() === 0 ? "text-brand" : "";
                    return (
                      <div key={k} role="gridcell" className={`flex min-h-[4.75rem] min-w-0 flex-col gap-0.5 px-0.5 pb-0.5 sm:min-h-[6.5rem] sm:gap-1 sm:px-1 sm:pb-1 ${!inMonth[i] ? "bg-bg" : hit > 0 ? "bg-hit" : "bg-card"}`}>
                        <span className="flex h-5 shrink-0 items-center justify-center">
                          <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] tabular-nums sm:text-xs ${isToday && inMonth[i] ? "bg-brand font-bold text-onbrand" : dateCls}`}>{day.getDate()}</span>
                        </span>
                        {lanes > 0 && <span aria-hidden style={{ height: `calc(${lanes} * var(--lane))` }} className="block shrink-0" />}
                        {list.map((s) => {
                          const ok = sel.size > 0 && matches(idx, s, sel);
                          const all = idx.roles.map((r) => actorOf(idx, s.cast[r.id]).n);
                          const names = all.slice(0, 3), more = all.length > names.length;
                          return (
                            <button key={s.id} onClick={() => onOpen(k, s.id)} aria-label={`${fmtDate(day)} ${s.time} ${all.join(", ")}, 전체 출연진 보기`} title={all.join(" / ")}
                              className={`block w-full min-w-0 rounded-md border px-0.5 py-0.5 text-left leading-tight transition-colors sm:px-1.5 sm:py-1 ${ok ? "border-brand bg-brand text-onbrand" : `border-line bg-bg hover:border-brand ${sel.size > 0 ? "opacity-40" : ""}`}`}>
                              <span className="flex flex-wrap items-center gap-x-0.5 text-[9px] font-bold tabular-nums opacity-80 sm:gap-x-1 sm:text-[10px]">
                                {s.time}{s.curtain && <Star size={9} aria-hidden />}
                              </span>
                              {names.map((n, j) => <span key={j} className="block truncate text-[9px] font-medium leading-[1.2] sm:text-[10px]">{n}</span>)}
                              {more && <span aria-hidden className="block text-[9px] font-bold leading-none opacity-70 sm:text-[10px]">…</span>}
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
                {bars.length > 0 && (
                  <div className="pointer-events-none absolute inset-x-0 top-5">
                    {bars.map((b) => (
                      <button key={b.ev.id} onClick={() => onOpenEvent?.(b.ev)} aria-label={`이벤트 ${b.ev.title}, 자세히 보기`}
                        style={{ top: `calc(${b.lane} * var(--lane))`, height: "calc(var(--lane) - 2px)", left: `calc(${b.col} / 7 * 100% + 1px)`, width: `calc(${b.span} / 7 * 100% - 2px)`, ...(isHex6(b.ev.color) ? { background: b.ev.color, color: readableOn(b.ev.color) } : {}) }}
                        className={`pointer-events-auto absolute truncate ${isHex6(b.ev.color) ? "" : "bg-ink text-bg"} px-1 text-left text-[10px] font-bold leading-[calc(1.25rem-2px)] sm:px-1.5 sm:text-xs sm:leading-[calc(1.5rem-2px)] ${b.contLeft ? "rounded-l-none" : "rounded-l-md"} ${b.contRight ? "rounded-r-none" : "rounded-r-md"}`}>
                        {b.ev.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
