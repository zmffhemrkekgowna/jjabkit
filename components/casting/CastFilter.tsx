"use client";

import { useMemo, useState } from "react";
import { Check, ChevronDown, Heart, RotateCcw, X } from "lucide-react";
import { actorOf, type ShowIndex } from "@/lib/casting";
import { useFavorites } from "@/lib/favorites";
import { HeartButton } from "../ui/HeartButton";

interface Props {
  idx: ShowIndex; sel: Set<string>; toggle: (id: string) => void; selectMany: (ids: string[]) => void; reset: () => void;
  only: boolean; setOnly: (v: boolean) => void; hits: number;
}

export default function CastFilter({ idx, sel, toggle, selectMany, reset, only, setOnly, hits }: Props) {
  const fav = useFavorites();
  // 처음 들어오면 항상 펼쳐요(배우 수와 상관없이). 접기·펼치기는 사용자가 누를 때만 바뀌고, 어디에도 저장하지 않아요.
  const [open, setOpen] = useState(true);
  const [onlySel, setOnlySel] = useState(false);
  const [closedRoles, setClosedRoles] = useState<Set<string>>(new Set());
  // 이 공연에 출연하는 관심 배우(이름이 같은 배우 포함)
  const favIds = idx.roles.flatMap((r) => r.actors).filter((a) => fav.actors.has(a.n)).map((a) => a.id);
  const selected = useMemo(() => [...sel].map((id) => actorOf(idx, id)).filter((a) => a.id), [sel, idx]);
  const dirty = sel.size > 0 || only || onlySel;
  const resetAll = () => { reset(); setOnlySel(false); };
  const toggleRole = (id: string) => setClosedRoles((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // '선택만 보기'일 때는 선택한 배우만 남기고, 남는 배우가 없는 배역은 숨겨요.
  const roles = idx.roles
    .map((r) => ({ r, actors: r.actors.filter((a) => !onlySel || sel.has(a.id)) }))
    .filter((x) => x.actors.length > 0);

  return (
    <section aria-label="배우 필터" className="rounded-2xl border border-line bg-card p-3 sm:p-4">
      {idx.roles.length === 0 && <p className="text-sm text-mute">등록된 배역이 없어요. 관리자에서 배역과 배우를 추가하면 여기서 고를 수 있어요.</p>}

      {idx.roles.length > 0 && (
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="cast-filter-body"
            className="flex min-h-[44px] flex-1 items-center gap-2 text-left text-sm font-bold">
            <ChevronDown size={16} aria-hidden className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
            배우 필터
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${sel.size > 0 ? "bg-brand text-onbrand" : "border border-line text-mute"}`}>
              {sel.size > 0 ? `선택된 배우 ${sel.size}명` : "전체 배우"}
            </span>
          </button>
          <button onClick={resetAll} disabled={!dirty} className="flex min-h-[44px] items-center gap-1 rounded-lg border border-line px-3 text-sm disabled:opacity-40">
            <RotateCcw size={14} aria-hidden />초기화
          </button>
        </div>
      )}

      {selected.length > 0 && (
        <ul aria-label="선택한 배우" className="mt-1 flex flex-wrap gap-1.5 border-b border-line pb-2">
          {selected.map((a) => (
            <li key={a.id}>
              <button onClick={() => toggle(a.id)} aria-label={`${a.n} 선택 해제`} className="inline-flex min-h-[36px] items-center gap-1 rounded-full bg-brand px-3 text-sm text-onbrand">
                {a.n}<span className="opacity-80">({idx.roles.find((r) => r.id === a.roleId)?.name})</span><X size={12} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}

      {idx.roles.length > 0 && open && (
        <div id="cast-filter-body" className="mt-0.5">
          <div className="grid gap-2 sm:gap-2.5">
            {roles.map(({ r, actors }) => {
              const folded = closedRoles.has(r.id);
              const nSel = r.actors.filter((a) => sel.has(a.id)).length;
              return (
                <div key={r.id} className="grid grid-cols-1 items-start gap-x-2 gap-y-0.5 rounded-xl sm:grid-cols-[6rem_minmax(0,1fr)] sm:gap-y-0">
                  <button onClick={() => toggleRole(r.id)} aria-expanded={!folded} aria-label={`${r.name} 배우 ${folded ? "펼치기" : "접기"}`}
                    className="flex min-h-[32px] w-full items-center gap-1 text-left text-[13px] font-bold text-ink sm:min-h-[36px] sm:text-sm">
                    <ChevronDown size={13} aria-hidden className={`shrink-0 text-mute transition-transform ${folded ? "-rotate-90" : ""}`} />
                    <span className="min-w-0 break-keep leading-tight">{r.name}</span>
                    {folded && <span className="shrink-0 text-[11px] font-normal text-mute">{nSel > 0 ? `${nSel}/` : ""}{r.actors.length}</span>}
                  </button>
                  {!folded && (
                    <div className="grid grid-cols-3 gap-1 min-[380px]:grid-cols-4 sm:gap-1.5 sm:grid-cols-[repeat(auto-fill,minmax(9rem,10rem))]">
                      {actors.map((a) => {
                        const on = sel.has(a.id);
                        const name = actorOf(idx, a.id).n;
                        return (
                          <span key={a.id} className={`relative grid min-h-10 min-w-0 grid-cols-[minmax(0,1fr)_22px] items-stretch rounded-full border transition-colors sm:min-h-9 sm:grid-cols-[minmax(0,1fr)_2rem] ${on ? "border-brand bg-brand font-bold text-onbrand" : "border-line bg-card hover:border-brand"}`}>
                            {/* 이름 영역(왼쪽)과 하트 영역(오른쪽)을 나누고, 이름은 하트를 뺀 나머지 영역의 가운데에 둬요. */}
                            <button aria-pressed={on} onClick={() => toggle(a.id)} className="col-start-1 row-start-1 flex min-h-10 min-w-0 items-center justify-center break-keep rounded-full px-1 py-1 text-center text-[13px] leading-tight sm:min-h-9 sm:px-2 sm:text-sm">
                              {on && <Check size={12} strokeWidth={3} aria-hidden className="absolute left-3 hidden sm:block" />}<span className="min-w-0 [overflow-wrap:anywhere]">{name}</span>
                            </button>
                            <HeartButton on={fav.actors.has(name)} onClick={() => fav.toggleActor(name)} label={name} size={13} inverted={on} className="col-start-2 row-start-1 h-full w-full !p-0" />
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
            {roles.length === 0 && (
              <p className="text-sm text-mute">
                아직 선택한 배우가 없어요. ‘선택한 배우만 보기’를 끄고 배우를 골라 보세요.
              </p>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={onlySel} onChange={(e) => setOnlySel(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />선택한 배우만 보기
            </label>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-2">
        <p aria-live="polite" className="text-sm">
          {sel.size > 0 ? <>조건에 맞는 회차 <b className="text-brand">{hits}</b> / {idx.sessions.length}회</> : <>전체 {idx.sessions.length}회차</>}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {favIds.length > 0 && (
            <button onClick={() => selectMany(favIds)} className="flex min-h-[44px] items-center gap-1 rounded-lg border border-line px-3 text-sm">
              <Heart size={14} fill="currentColor" aria-hidden />관심 배우만
            </button>
          )}
        </div>
      </div>
      {sel.size > 0 && hits === 0 && (
        <p role="status" className="mt-2 rounded-lg bg-bg p-2 text-sm">
          선택한 배우가 모두 함께 출연하는 회차가 없어요. 같은 배역이 아닌 배우끼리는 한 회차에 같이 서야 해요. 배우를 줄이거나 <button onClick={reset} className="font-bold text-brand underline">초기화</button>해 보세요.
        </p>
      )}
      {sel.size > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-mute">
          다른 배역의 배우를 함께 고르면 모두 출연하는 회차만, 같은 배역에서 여러 명을 고르면 그중 한 명이라도 출연하는 회차가 표시돼요.
        </p>
      )}
    </section>
  );
}
