"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Pin, X } from "lucide-react";
import { KIND_LABEL, type Notice } from "@/types/notice";
import { fmtNoticeDate, markSeen, readSeen, unreadOf } from "@/lib/notices";

/**
 * 상단 막대의 '소식' 버튼과 모달.
 * - 아직 열어 보지 않은 소식이 있으면 N 배지가 떠요. (열어 본 시각은 이 브라우저의 localStorage에 저장)
 * - 본문은 글자 그대로만 보여줘요(HTML로 해석하지 않아요).
 */
export default function NoticeBell({ notices }: { notices: Notice[] }) {
  const [seen, setSeen] = useState<string | null>(null); // null = 아직 저장소를 읽기 전
  const [open, setOpen] = useState(false);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set()); // 모달을 연 순간의 '새 소식'
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => { setSeen(readSeen()); }, []);

  const unread = seen === null ? 0 : unreadOf(notices, seen).length;

  const show = () => {
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setFreshIds(new Set(unreadOf(notices, seen ?? "").map((n) => n.id)));
    setSeen(markSeen(notices) || seen);
    setOpen(true);
  };
  const close = useCallback(() => { setOpen(false); opener.current?.focus(); }, []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { close(); return; }
      if (e.key !== "Tab" || !dialogRef.current) return;
      const f = dialogRef.current.querySelectorAll<HTMLElement>("a[href], button");
      if (f.length === 0) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, close]);

  return (
    <>
      <button onClick={show} aria-label={unread > 0 ? `업데이트·소식, 새 소식 ${unread}개` : "업데이트·소식"} aria-haspopup="dialog"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-line text-mute hover:text-brand">
        <Bell size={16} aria-hidden />
        {unread > 0 && (
          <span aria-hidden className="absolute -right-1.5 -top-1.5 rounded-full bg-brand px-1 text-[10px] font-bold leading-4 text-onbrand">N</span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="notice-title"
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl border border-line bg-card shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 id="notice-title" className="font-bold">업데이트 · 소식</h2>
              <button ref={closeRef} onClick={close} aria-label="소식 닫기" className="rounded-full border border-line p-2"><X size={16} aria-hidden /></button>
            </div>
            <div className="overflow-y-auto px-4 py-3">
              {notices.length === 0 ? (
                <p className="py-8 text-center text-sm text-mute">아직 올라온 소식이 없어요.</p>
              ) : (
                <ul className="space-y-3">
                  {notices.map((n) => (
                    <li key={n.id} className="rounded-xl border border-line bg-bg p-3">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs">
                        <span className="rounded-full border border-brand px-2 py-0.5 font-medium text-brand">{KIND_LABEL[n.kind]}</span>
                        {n.pinned && <span className="inline-flex items-center gap-0.5 text-mute"><Pin size={11} aria-hidden />고정</span>}
                        {freshIds.has(n.id) && <span className="rounded bg-brand px-1.5 py-0.5 font-bold text-onbrand">NEW</span>}
                        <span className="ml-auto tabular-nums text-mute">{fmtNoticeDate(n.createdAt)}</span>
                      </div>
                      <h3 className="mt-1.5 text-sm font-bold">{n.title}</h3>
                      {n.body && <p className="mt-1 whitespace-pre-line text-sm text-mute">{n.body}</p>}
                      {n.showId && (
                        <Link href={`/shows/${n.showId}`} onClick={close} className="mt-2 inline-block text-sm font-medium text-brand underline-offset-2 hover:underline">
                          공연 보러 가기 →
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
