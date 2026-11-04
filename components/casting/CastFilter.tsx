"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Heart, RotateCcw, Search, X } from "lucide-react";
import { actorOf, type ShowIndex } from "@/lib/casting";
import { useFavorites } from "@/lib/favorites";
import { HeartButton } from "../ui/HeartButton";

interface Props {
  idx: ShowIndex; sel: Set<string>; toggle: (id: string) => void; selectMany: (ids: string[]) => void; reset: () => void;
  only: boolean; setOnly: (v: boolean) => void; hits: number;
}

/** 배우가 이만큼보다 많으면 필터를 처음에 접어 둬요(달력이 화면 아래로 밀리지 않게). 선택한 배우는 접혀 있어도 요약에 보여요. */
const AUTO_COLLAPSE = 8;

export default function CastFilter({ idx, sel, toggle, selectMany, reset, only, setOnly, hits }: Props) {
  const fav = useFavorites();
  const total = idx.roles.reduce((n, r) => n + r.actors.length, 0);
  const [open, setOpen] = useState(total <= AUTO_COLLAPSE);
  const [q, setQ] = useState("");
  const [onlySel, setOnlySel] = useState(false);
  const [closedRoles, setClosedRoles] = useState<Set<string>>(new Set());
  // 이 공연에 출연하는 관심 배우(이름이 같은 배우 포함)
  const favIds = idx.roles.flatMap((r) => r.actors).filter((a) => fav.actors.has(a.n)).map((a) => a.id);
  const selected = useMemo(() => [...sel].map((id) => actorOf(idx, id)).filter((a) => a.id), [sel, idx]);
  const k = q.trim().toLowerCase().replace(/\s+/g, "");
  const searching = k !== "";
  const toggleRole = (id: string) => setClosedRoles((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  // 검색 중이거나 '선택만 보기'일 때는 해당하는 배우만 남기고, 남는 배우가 없는 배역은 숨겨요.
  const roles = idx.roles
    .map((r) => ({ r, actors: r.actors.filter((a) => (!searching || a.n.toLowerCase().replace(/\s+/g, "").includes(k)) && (!onlySel || sel.has(a.id))) }))
    .filter((x) => x.actors.length > 0);

  return (
    <section aria-label="배우 필터" className="rounded-2xl border border-line bg-card p-3">
      {idx.roles.length === 0 && <p className="text-sm text-mute">등록된 배역이 없어요. 관리자에서 배역과 배우를 추가하면 여기서 고를 수 있어요.</p>}

      {idx.roles.length > 0 && (
        <div className="flex items-center gap-2">
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-controls="cast-filter-body"
            className="flex min-h-[44px] flex-1 items-center gap-2 text-left text-sm font-bold">
            <ChevronDown size={16} aria-hidden className={`shrink-0 transition-transform ${open ? "" : "-rotate-90"}`} />
            배우 필터
            <span className={`rounded-full px-2 py-0.5 text-xs ${sel.size > 0 ? "bg-brand text-onbrand" : "border border-line text-mute"}`}>
              {sel.size > 0 ? `${sel.size}명 선택` : "선택 없음"}
            </span>
          </button>
          <button onClick={reset} disabled={sel.size === 0} className="flex min-h-[44px] items-center gap-1 rounded-lg border border-line px-3 text-sm disabled:opacity-40">
            <RotateCcw size={14} aria-hidden />초기화
          </button>
        </div>
      )}

      {selected.length > 0 && (
        <ul aria-label="선택한 배우" className="mt-1 flex flex-wrap gap-1.5">
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
        <div id="cast-filter-body" className="mt-2">
          {total > 6 && (
            <div className="relative mb-2">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-mute"><Search size={14} aria-hidden /></span>
              <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="배우 이름 검색" aria-label="배우 이름 검색"
                className="min-h-[44px] w-full rounded-lg border border-line bg-bg py-2 pl-9 pr-9 text-sm [&::-webkit-search-cancel-button]:appearance-none" />
              {q && <button onClick={() => setQ("")} aria-label="배우 검색어 지우기" className="absolute right-0 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-mute"><X size={14} aria-hidden /></button>}
            </div>
          )}
          <div className="grid gap-2.5">
            {roles.map(({ r, actors }) => {
              const folded = closedRoles.has(r.id) && !searching;
              const nSel = r.actors.filter((a) => sel.has(a.id)).length;
              return (
                <div key={r.id} className="grid grid-cols-[4.5rem_1fr] items-start gap-2">
                  <button onClick={() => toggleRole(r.id)} aria-expanded={!folded} aria-label={`${r.name} 배우 ${folded ? "펼치기" : "접기"}`}
                    className="flex min-h-[44px] items-center gap-0.5 text-left text-xs font-medium text-mute">
                    <ChevronDown size={12} aria-hidden className={`shrink-0 ${folded ? "-rotate-90" : ""}`} />
                    <span className="min-w-0 break-keep">{r.name}</span>
                    {folded && <span className="ml-0.5 shrink-0 text-[10px]">{nSel > 0 ? `${nSel}/` : ""}{r.actors.length}</span>}
                  </button>
                  {!folded && (
                    <div className="flex flex-wrap gap-1.5">
                      {actors.map((a) => {
                        const on = sel.has(a.id);
                        const name = actorOf(idx, a.id).n;
                        return (
                          <span key={a.id} className={`inline-flex items-center rounded-full border transition-colors ${on ? "border-brand bg-brand text-onbrand" : "border-line hover:border-brand"}`}>
                            <button aria-pressed={on} onClick={() => toggle(a.id)} className="min-h-[40px] rounded-full pl-3 pr-1 text-sm">{name}</button>
                            <HeartButton on={fav.actors.has(name)} onClick={() => fav.toggleActor(name)} label={name} size={14} inverted={on} className="mr-0.5 !p-2.5" />
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
                {onlySel && sel.size === 0 ? "아직 선택한 배우가 없어요. ‘선택만 보기’를 끄고 배우를 골라 보세요." : `‘${q.trim()}’ 배우를 찾지 못했어요. 이름의 일부만 입력해 보세요.`}
              </p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
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
          <label className="flex min-h-[44px] cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} className="h-5 w-5 accent-[var(--brand)]" />해당 회차만
          </label>
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
