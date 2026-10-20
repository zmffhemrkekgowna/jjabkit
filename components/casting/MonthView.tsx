"use client";

import { Percent, Star } from "lucide-react";
import { DOW, actorOf, addDays, fmtDate, matches, toKey, visibleOn, type ShowIndex } from "@/lib/casting";

interface Props {
  idx: ShowIndex; cursor: Date; sel: Set<string>; only: boolean; today: string;
  onOpen: (date: string, sid?: string) => void;
}

export default function MonthView({ idx, cursor, sel, only, today, onOpen }: Props) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const days: Date[] = [];
  for (let d = addDays(first, -first.getDay()); d <= last || days.length % 7 !== 0; d = addDays(d, 1)) days.push(d);

  return (
    <div>
      <div role="grid" aria-label={`${cursor.getFullYear()}년 ${cursor.getMonth() + 1}월 캐스팅 달력`} className="overflow-x-auto rounded-2xl border border-line bg-card">
        {/* 칸이 좁아 이름이 깨지지 않도록 최소 너비를 두고, 좁은 화면에서는 좌우로 밀어서 봐요 */}
        <div className="min-w-[45.5rem]">
          <div className="grid grid-cols-7 py-2 text-center text-xs text-mute">
            {DOW.map((w, i) => <div key={w} className={i === 0 ? "text-brand" : ""}>{w}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-px border-t border-line bg-line">
            {days.map((day) => {
              const k = toKey(day);
              const inMonth = day.getMonth() === cursor.getMonth();
              const list = inMonth ? visibleOn(idx, k, sel, only) : [];
              const hit = sel.size > 0 ? list.filter((s) => matches(idx, s, sel)).length : 0;
              const dateCls = !inMonth ? "opacity-30" : k === today ? "font-bold text-brand" : day.getDay() === 0 ? "text-brand" : "";
              return (
                <div key={k} role="gridcell" className={`flex min-h-[6.5rem] min-w-0 flex-col gap-1 p-1 ${!inMonth ? "bg-bg" : hit > 0 ? "bg-hit" : "bg-card"}`}>
                  <span className={`px-0.5 text-xs tabular-nums ${dateCls}`}>{day.getDate()}</span>
                  {list.map((s) => {
                    const ok = sel.size > 0 && matches(idx, s, sel);
                    const names = idx.roles.slice(0, 2).map((r) => actorOf(idx, s.cast[r.id]).n);
                    return (
                      <button key={s.id} onClick={() => onOpen(k, s.id)} aria-label={`${fmtDate(day)} ${s.time} ${names.join(", ")}, 전체 출연진 보기`}
                        className={`block w-full min-w-0 rounded-md border px-1.5 py-1 text-left leading-tight transition-colors ${ok ? "border-brand bg-brand text-onbrand" : `border-line bg-bg hover:border-brand ${sel.size > 0 ? "opacity-40" : ""}`}`}>
                        <span className="flex items-center gap-1 text-[10px] font-bold tabular-nums opacity-80">
                          {s.time}{s.curtain && <Star size={9} aria-hidden />}{s.timesale && <Percent size={9} aria-hidden />}
                        </span>
                        <span className="block truncate text-[11px] font-medium">{names.join(" / ")}</span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <p className="mt-2 text-xs text-mute md:hidden">좌우로 밀면 전체 요일을 볼 수 있어요.</p>
    </div>
  );
}
