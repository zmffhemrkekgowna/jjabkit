"use client";

import { actorOf, addDays, fmtDate, matches, toKey, visibleOn, weekStart, type ShowIndex } from "@/lib/casting";
import { CurtainTag, TimeSaleTag } from "../ui/Tags";

interface Props { idx: ShowIndex; cursor: Date; sel: Set<string>; only: boolean; onOpen: (date: string, sid?: string) => void }

export default function WeekView({ idx, cursor, sel, only, onOpen }: Props) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart(cursor), i)).filter((d) => visibleOn(idx, toKey(d), sel, only).length > 0);
  if (days.length === 0) {
    return <p className="rounded-2xl border border-line bg-card p-6 text-center text-sm text-mute">이 주에는 조건에 맞는 회차가 없어요.</p>;
  }
  return (
    <div className="space-y-4">
      {days.map((day) => {
        const k = toKey(day);
        return (
          <section key={k}>
            <h3 className="mb-2 text-sm font-bold">{fmtDate(day)}</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleOn(idx, k, sel, only).map((s) => {
                const ok = sel.size > 0 && matches(idx, s, sel);
                return (
                  <button key={s.id} onClick={() => onOpen(k, s.id)}
                    className={`rounded-xl border p-3 text-left ${ok ? "border-brand bg-hit" : "border-line bg-card"} ${sel.size > 0 && !ok ? "opacity-50" : ""}`}>
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="font-bold tabular-nums">{s.time}</span>
                      {s.curtain && <CurtainTag />}{s.timesale && <TimeSaleTag />}
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-sm">
                      {idx.roles.map((r) => {
                        const a = actorOf(idx, s.cast[r.id]);
                        return (
                          <span key={r.id} className={sel.has(a.id) ? "font-bold text-brand" : ""}>
                            <span className="mr-1 text-xs text-mute">{r.short}</span>{a.n}
                          </span>
                        );
                      })}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
