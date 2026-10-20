"use client";

import { Calendar, GraduationCap, Heart, Percent, Star, Users, Clock } from "lucide-react";
import type { Show } from "@/types/show";
import { fmtDate, fromKey, type ShowIndex } from "@/lib/casting";
import { buildEvents, type EventIcon } from "@/lib/events";

const ICONS: Record<EventIcon, typeof Clock> = { clock: Clock, cap: GraduationCap, star: Star, pct: Percent, heart: Heart, users: Users };

export default function EventsTab({ show, idx, onOpen }: { show: Show; idx: ShowIndex; onOpen: (date: string) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {buildEvents(show, idx).map((e) => {
        const Icon = ICONS[e.icon];
        return (
          <article key={e.id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex items-center justify-between bg-hit px-4 py-3">
              <span className="flex items-center gap-2 text-sm font-bold text-brand"><Icon size={18} aria-hidden />{e.type}</span>
              <span className="font-serif text-2xl font-bold text-brand">{e.rate}</span>
            </div>
            <div className="flex flex-1 flex-col gap-2 p-4">
              <h3 className="font-bold">{e.title}</h3>
              <p className="text-sm leading-relaxed text-mute">{e.desc}</p>
              <p className="flex items-center gap-1.5 text-xs text-mute"><Calendar size={13} aria-hidden />{e.period}</p>
              <ul className="flex flex-wrap gap-1.5">
                {e.cond.map((c) => <li key={c} className="rounded-full border border-line px-2 py-0.5 text-xs text-mute">{c}</li>)}
              </ul>
              {e.dates && e.dates.length > 0 && (
                <div className="mt-auto flex flex-wrap gap-2 pt-1">
                  {e.dates.map((k) => (
                    <button key={k} onClick={() => onOpen(k)} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-onbrand">
                      {fmtDate(fromKey(k))} 회차 보기
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        );
      })}
    </div>
  );
}
