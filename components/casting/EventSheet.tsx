"use client";

import { useRef } from "react";
import { CalendarDays, ExternalLink, X } from "lucide-react";
import type { EventItem } from "@/types/event";
import { isHttpUrl, periodText } from "@/lib/period";
import { isHex6 } from "@/lib/color";
import { useDialogFocus } from "@/lib/useDialogFocus";

/** 달력의 이벤트 막대를 누르면 올라오는 하단 시트: 제목, 기간, 공지 링크. */
export default function EventSheet({ event, onClose }: { event: EventItem; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, onClose, closeRef);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="event-sheet-title" onClick={(e) => e.stopPropagation()}
        className="sheet max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card pb-6 shadow-2xl">
        {isHex6(event.color) && <div aria-hidden className="mx-5 mt-5 h-1.5 rounded-full" style={{ background: event.color }} />}
        <div className="flex items-start gap-2 px-5 pt-4">
          <h2 id="event-sheet-title" className="min-w-0 flex-1 text-lg font-bold">{event.title}</h2>
          <button ref={closeRef} onClick={onClose} aria-label="닫기" className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-mute hover:text-ink"><X size={18} aria-hidden /></button>
        </div>
        <div className="space-y-3 px-5 pt-2 text-sm">
          <p className="inline-flex items-center gap-1 text-xs text-mute"><CalendarDays size={12} aria-hidden />{periodText(event)}</p>
          {isHttpUrl(event.linkUrl)
            ? <div><a href={event.linkUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg bg-brand px-3 py-2 text-sm font-medium text-onbrand">공지 보기<ExternalLink size={14} aria-hidden /></a></div>
            : <p className="text-mute">연결된 공지가 없어요.</p>}
        </div>
      </div>
    </div>
  );
}
