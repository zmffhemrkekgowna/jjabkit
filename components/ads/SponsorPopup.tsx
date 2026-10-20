"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { X, ExternalLink } from "lucide-react";
import { SPONSORS, hideSponsorForToday, isSponsorHidden, type Sponsor } from "@/lib/ads";

/**
 * 제휴 제작사 홍보 팝업(레이어 모달).
 * - 메인(/) 첫 진입 때만 떠요. 관리자 화면에는 안 떠요.
 * - 오른쪽 위 X: 이번만 닫기. "오늘 하루 동안 보지 않기": 24시간 동안 다시 안 띄우기(LocalStorage).
 * - Esc, 바깥 클릭으로도 닫혀요(이때는 24시간 숨김을 저장하지 않아요).
 */
export default function SponsorPopup() {
  const path = usePathname() ?? "";
  const decided = useRef(false); // 한 번 판단하면 같은 방문 중엔 다시 띄우지 않아요
  const [sponsor, setSponsor] = useState<Sponsor | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<Element | null>(null);

  useEffect(() => {
    if (decided.current || path !== "/") return;
    decided.current = true;
    if (SPONSORS.length === 0 || isSponsorHidden()) return;
    opener.current = document.activeElement;
    setSponsor(SPONSORS[Math.floor(Math.random() * SPONSORS.length)]);
  }, [path]);

  const close = useCallback(() => {
    setSponsor(null);
    if (opener.current instanceof HTMLElement) opener.current.focus();
  }, []);

  const hideToday = useCallback(() => {
    hideSponsorForToday();
    close();
  }, [close]);

  useEffect(() => {
    if (!sponsor) return;
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
  }, [sponsor, close]);

  if (!sponsor || path.startsWith("/admin")) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="sponsor-title"
        className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
        <button ref={closeRef} onClick={close} aria-label="팝업 닫기"
          className="absolute right-2 top-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white hover:bg-black/75">
          <X size={20} aria-hidden />
        </button>

        <a href={sponsor.href} target="_blank" rel="sponsored noopener noreferrer" className="block">
          <div className="relative aspect-[4/5] w-full overflow-hidden text-white"
            style={sponsor.image ? undefined : { backgroundImage: `linear-gradient(160deg, ${sponsor.from}, ${sponsor.to})` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {sponsor.image && <img src={sponsor.image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
            <span className="absolute left-3 top-3 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-medium">광고 · 제휴</span>
            <div className="absolute inset-x-0 bottom-0 p-5">
              <p className="text-xs tracking-wide opacity-90">{sponsor.producer} 제작</p>
              <h2 id="sponsor-title" className="mt-1 font-serif text-3xl font-bold leading-tight">{sponsor.title}</h2>
              <p className="mt-2 text-sm opacity-90">{sponsor.tagline}</p>
              <p className="mt-3 text-xs opacity-90">{sponsor.period}</p>
              <p className="text-xs opacity-90">{sponsor.venue}</p>
              <span className="mt-4 inline-flex items-center gap-1 rounded-lg bg-white px-3.5 py-2 text-sm font-bold text-black">
                {sponsor.cta}<ExternalLink size={14} aria-hidden />
              </span>
            </div>
          </div>
        </a>

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
