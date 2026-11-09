"use client";

import { Calendar } from "lucide-react";
import type { Show } from "@/types/show";
import type { ShowIndex } from "@/lib/casting";
import type { EventItem } from "@/types/event";
import { scopeText } from "@/lib/eventScope";
import { isHex6 } from "@/lib/color";

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
                <span className="mt-1 flex items-center gap-1 text-xs text-mute"><Calendar size={12} aria-hidden />{scopeText(e)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    )}
    {events.length === 0 && (
      <p className="rounded-2xl border border-dashed border-line px-4 py-10 text-center text-sm text-mute">등록된 이벤트가 아직 없어요.</p>
    )}
    </div>
  );
}
