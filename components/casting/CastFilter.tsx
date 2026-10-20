"use client";

import { Heart, RotateCcw } from "lucide-react";
import { actorOf, type ShowIndex } from "@/lib/casting";
import { useFavorites } from "@/lib/favorites";
import { HeartButton } from "../ui/HeartButton";

interface Props {
  idx: ShowIndex; sel: Set<string>; toggle: (id: string) => void; selectMany: (ids: string[]) => void; reset: () => void;
  only: boolean; setOnly: (v: boolean) => void; hits: number;
}

export default function CastFilter({ idx, sel, toggle, selectMany, reset, only, setOnly, hits }: Props) {
  const fav = useFavorites();
  // 이 공연에 출연하는 관심 배우(이름이 같은 배우 포함)
  const favIds = idx.roles.flatMap((r) => r.actors).filter((a) => fav.actors.has(a.n)).map((a) => a.id);

  return (
    <section aria-label="배우 필터" className="rounded-2xl border border-line bg-card p-3">
      {idx.roles.length === 0 && <p className="text-sm text-mute">등록된 배역이 없어요.</p>}
      <div className="grid gap-2.5">
        {idx.roles.map((r) => (
          <div key={r.id} className="grid grid-cols-[4.5rem_1fr] items-center gap-2">
            <span className="text-xs font-medium text-mute">{r.name}</span>
            <div className="flex flex-wrap gap-1.5">
              {r.actors.map((a) => {
                const on = sel.has(a.id);
                const name = actorOf(idx, a.id).n;
                return (
                  <span key={a.id} className={`inline-flex items-center rounded-full border transition-colors ${on ? "border-brand bg-brand text-onbrand" : "border-line hover:border-brand"}`}>
                    <button aria-pressed={on} onClick={() => toggle(a.id)} className="rounded-full py-1.5 pl-3 pr-1 text-sm">{name}</button>
                    <HeartButton on={fav.actors.has(name)} onClick={() => fav.toggleActor(name)} label={name} size={14} inverted={on} className="mr-0.5 !p-1" />
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
        <p aria-live="polite" className="text-sm">
          {sel.size > 0 ? <>조건에 맞는 회차 <b className="text-brand">{hits}</b> / {idx.sessions.length}회</> : <>전체 {idx.sessions.length}회차</>}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={only} onChange={(e) => setOnly(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />해당 회차만
          </label>
          {favIds.length > 0 && (
            <button onClick={() => selectMany(favIds)} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm">
              <Heart size={14} fill="currentColor" aria-hidden />관심 배우만
            </button>
          )}
          <button onClick={reset} disabled={sel.size === 0} className="flex items-center gap-1 rounded-lg border border-line px-2.5 py-1.5 text-sm disabled:opacity-40">
            <RotateCcw size={14} aria-hidden />초기화
          </button>
        </div>
      </div>
      {sel.size > 0 && (
        <p className="mt-2 text-xs leading-relaxed text-mute">
          다른 배역의 배우를 함께 고르면 모두 출연하는 회차만, 같은 배역에서 여러 명을 고르면 그중 한 명이라도 출연하는 회차가 표시돼요.
        </p>
      )}
    </section>
  );
}
