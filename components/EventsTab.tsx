"use client";

import { Calendar, GraduationCap, Heart, Star, Users, Clock } from "lucide-react";
import type { Show } from "@/types/show";
import { fmtDate, fromKey, type ShowIndex } from "@/lib/casting";
import type { EventItem } from "@/types/event";
import { periodText } from "@/lib/period";
import { isHex6 } from "@/lib/color";
import { buildEvents, type EventIcon } from "@/lib/events";

const ICONS: Record<EventIcon, typeof Clock> = { clock: Clock, cap: GraduationCap, star: Star, heart: Heart, users: Users };

export default function EventsTab({ show, idx, events = [], onOpen, onOpenEvent }: { show: Show; idx: ShowIndex; events?: EventItem[]; onOpen: (date: string) => void; onOpenEvent?: (e: EventItem) => void }) {
  return (
    <div className="space-y-4">
    {events.length > 0 && (
      <section aria-label="등록된 이벤트">
        <h2 className="mb-2 text-sm font-bold">이벤트 <span className="font-normal text-mute">{events.length}</span></h2>
        <ul className="space-y-2">
          {events.map((e) => (
            <li key={e.id}>
              <button onClick={() => onOpenEvent?.(e)} className="block w-full rounded-2xl border border-line bg-card p-3 text-left hover:border-brand">
                <span className="flex items-center gap-1.5 text-sm font-bold">{isHex6(e.color) && <span aria-hidden className="inline-block h-3 w-3 shrink-0 rounded-full border border-line" style={{ background: e.color }} />}{e.title}</span>
                <span className="mt-1 flex items-center gap-1 text-xs text-mute"><Calendar size={12} aria-hidden />{periodText(e)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    )}
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
    </div>
  );
}
