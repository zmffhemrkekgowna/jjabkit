"use client";

import { useEffect, useRef } from "react";
import { Clock, ExternalLink, X } from "lucide-react";
import { SITES, actorOf, fmtDate, fromKey, matches, visibleOn, type ShowIndex } from "@/lib/casting";
import { useFavorites } from "@/lib/favorites";
import Avatar from "../ui/Avatar";
import { HeartButton } from "../ui/HeartButton";
import { CurtainTag, TimeSaleTag } from "../ui/Tags";

interface Props {
  idx: ShowIndex; date: string; focusId?: string; sel: Set<string>; only: boolean;
  toggle: (id: string) => void; onClose: () => void;
  /** 마이페이지에서 열 때: sel은 관심 배우이고, 한 명이라도 출연하면 강조해요 */
  favMode?: boolean;
}

/** 날짜·회차를 누르면 올라오는 하단 시트: 시간, 전체 출연진(하트), 예매처 */
export default function SessionSheet({ idx, date, focusId, sel, only, toggle, onClose, favMode = false }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fav = useFavorites();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    closeRef.current?.focus();
    if (focusId) document.getElementById(`sess-${focusId}`)?.scrollIntoView({ block: "nearest" });
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const list = favMode ? idx.byDate.get(date) ?? [] : visibleOn(idx, date, sel, only);
  const title = fmtDate(fromKey(date));

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={`${title} 회차 정보`} onClick={(e) => e.stopPropagation()}
        className="sheet max-h-[88vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-card pb-4 shadow-2xl">
        <div className="sticky top-0 z-10 bg-card px-4 pb-2 pt-3">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line" />
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">{title}</h2>
              <p className="text-xs text-mute">
                {list.length}회차 · {favMode ? "하트로 관심 배우를 등록해요" : "배우를 누르면 필터에, 하트를 누르면 관심 배우에 추가돼요"}
              </p>
            </div>
            <button ref={closeRef} onClick={onClose} aria-label="닫기" className="rounded-full border border-line p-2"><X size={18} aria-hidden /></button>
          </div>
        </div>

        <div className="space-y-3 px-4 pt-1">
          {list.map((s) => {
            const ok = sel.size > 0 && (favMode ? idx.roles.some((r) => sel.has(s.cast[r.id])) : matches(idx, s, sel));
            return (
              <article key={s.id} id={`sess-${s.id}`}
                className={`rounded-2xl border p-3 ${ok ? "border-brand bg-hit" : "border-line"} ${s.id === focusId ? "ring-2 ring-brand" : ""}`}>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Clock size={16} aria-hidden />
                  <span className="text-lg font-bold tabular-nums">{s.time}</span>
                  {s.curtain && <CurtainTag />}{s.timesale && <TimeSaleTag />}
                  {ok && <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-medium text-onbrand">{favMode ? "관심 배우 출연" : "선택 조건 일치"}</span>}
                </div>
                <ul className="grid gap-1">
                  {idx.roles.map((r) => {
                    const a = actorOf(idx, s.cast[r.id]);
                    const on = sel.has(a.id);
                    return (
                      <li key={r.id} className={`flex items-center rounded-xl pr-1 ${on ? "bg-brand text-onbrand" : "hover:bg-bg"}`}>
                        <button onClick={() => !favMode && a.id && toggle(a.id)} aria-pressed={on}
                          className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-2 py-1.5 text-left">
                          <Avatar name={a.n} size={38} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-bold">{a.n}</span>
                            <span className={`block truncate text-xs ${on ? "opacity-80" : "text-mute"}`}>{r.name}</span>
                          </span>
                          {!favMode && a.id && <span className={`shrink-0 text-xs ${on ? "" : "text-mute"}`}>{on ? "선택됨" : "+ 필터"}</span>}
                        </button>
                        {a.id && <HeartButton on={fav.actors.has(a.n)} onClick={() => fav.toggleActor(a.n)} label={a.n} inverted={on} className="shrink-0" />}
                      </li>
                    );
                  })}
                </ul>
                <p className="mb-1.5 mt-3 text-xs text-mute">예매처 바로가기</p>
                <div className="grid grid-cols-3 gap-2">
                  {SITES.map(([n, u]) => (
                    <a key={n} href={u} target="_blank" rel="noopener noreferrer"
                      className="flex items-center justify-center gap-1 rounded-xl border border-line py-2 text-sm font-medium hover:border-brand hover:text-brand">
                      {n}<ExternalLink size={13} aria-hidden />
                    </a>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}
