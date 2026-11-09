"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { hidePopupsForToday, visiblePopupIds } from "@/lib/ads";
import { isHttpUrl } from "@/lib/period";
import type { Popup } from "@/types/popup";

/**
 * 팝업 광고(레이어 모달). 관리자 화면 > 팝업 광고 탭에서 여러 개 등록하고 기간을 정해요.
 * - 서버가 '켜 둠 + 오늘이 기간 안'인 것만 넘겨줘요. 메인(/) 첫 진입 때만 떠요. 관리자 화면에는 안 떠요.
 * - 여러 개면 한 장씩 넘겨 볼 수 있어요(◀ ▶, 점).
 * - X / 닫기: 이번만 닫기. "오늘 하루 동안 보지 않기": 지금 떠 있는 팝업들을 24시간 숨겨요(LocalStorage).
 * - 팝업 글자는 그대로 보여줘요(HTML로 해석하지 않아요). 링크는 http(s) 주소만 열려요.
 */
export default function SponsorPopup({ popups }: { popups: Popup[] }) {
  const path = usePathname() ?? "";
  const decided = useRef(false); // 한 번 판단하면 같은 방문 중엔 다시 띄우지 않아요
  const [list, setList] = useState<Popup[]>([]);
  const [i, setI] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(new Set()); // 이미지를 못 불러온 팝업은 평소 모양(글자 포함)으로 보여줘요
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (decided.current || path !== "/") return;
    decided.current = true;
    const ids = new Set(visiblePopupIds(popups.map((p) => p.id)));
    const show = popups.filter((p) => ids.has(p.id));
    if (show.length === 0) return;
    opener.current = document.activeElement;
    setList(show);
  }, [path, popups]);

  const close = useCallback(() => {
    setList([]); setI(0);
    if (opener.current instanceof HTMLElement) opener.current.focus();
  }, []);

  const hideToday = useCallback(() => {
    hidePopupsForToday(list.map((p) => p.id));
    close();
  }, [list, close]);

  const open = list.length > 0;
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

  if (!open || path.startsWith("/admin")) return null;
  const p = list[Math.min(i, list.length - 1)];
  const [g1, g2] = p.gradient.split(",");
  const imgOnly = p.imageOnly && !!p.imageUrl && isHttpUrl(p.imageUrl) && !broken.has(p.id);
  const body = imgOnly ? (
    <div className="relative aspect-[4/5] w-full overflow-hidden bg-card">
      <h2 id="popup-title" className="sr-only">{p.title}</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={p.imageUrl} alt={p.title} onError={() => setBroken((s) => new Set(s).add(p.id))} className="absolute inset-0 h-full w-full object-cover" />
    </div>
  ) : (
    <div className="relative aspect-[4/5] w-full overflow-hidden text-white"
      style={p.imageUrl && isHttpUrl(p.imageUrl) ? undefined : { backgroundImage: `linear-gradient(160deg, ${g1}, ${g2})` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {p.imageUrl && isHttpUrl(p.imageUrl) && <img src={p.imageUrl} alt="" onError={() => setBroken((s) => new Set(s).add(p.id))} className="absolute inset-0 h-full w-full object-cover" />}
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
      <span className="absolute left-3 top-3 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium">{p.label || "광고"}</span>
      <div className="absolute inset-x-0 bottom-0 p-5">
        <h2 id="popup-title" className="font-serif text-3xl font-bold leading-tight">{p.title}</h2>
        {p.body && <p className="mt-2 whitespace-pre-line text-sm opacity-90">{p.body}</p>}
        {isHttpUrl(p.linkUrl) && (
          <span className="mt-4 inline-flex items-center gap-1 rounded-lg bg-white px-3.5 py-2 text-sm font-bold text-black">
            {p.cta}<ExternalLink size={14} aria-hidden />
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="popup-title"
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
        <button ref={closeRef} onClick={close} aria-label="팝업 닫기"
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75">
          <X size={20} aria-hidden />
        </button>

        {isHttpUrl(p.linkUrl)
          ? <a href={p.linkUrl} target="_blank" rel="sponsored noopener noreferrer" className="block">{body}</a>
          : body}

        {list.length > 1 && (
          <div className="flex items-center justify-center gap-3 border-t border-line py-2">
            <button onClick={() => setI((i + list.length - 1) % list.length)} aria-label="이전 팝업" className="rounded-full p-1 text-mute hover:text-ink"><ChevronLeft size={18} aria-hidden /></button>
            <span className="flex gap-1.5" aria-label={`${i + 1} / ${list.length}`}>
              {list.map((x, k) => <span key={x.id} className={`h-1.5 w-1.5 rounded-full ${k === i ? "bg-brand" : "bg-line"}`} />)}
            </span>
            <button onClick={() => setI((i + 1) % list.length)} aria-label="다음 팝업" className="rounded-full p-1 text-mute hover:text-ink"><ChevronRight size={18} aria-hidden /></button>
          </div>
        )}

        <div className="flex items-center justify-between gap-3 border-t border-line px-4 py-3">
          <button onClick={hideToday} className="rounded-lg px-1 py-1.5 text-sm text-mute underline-offset-2 hover:text-ink hover:underline">
            오늘 하루 동안 보지 않기
          </button>
          <button onClick={close} className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium">닫기</button>
        </div>
      </div>
    </div>
  );
}
