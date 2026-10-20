"use client";

import { Heart } from "lucide-react";
import { useFavorites } from "@/lib/favorites";

interface Props { on: boolean; onClick: () => void; label: string; size?: number; className?: string; inverted?: boolean }

/** 하트 토글. inverted는 배경이 브랜드색인 곳(선택된 칩·행)에서 글자색을 그대로 따라가게 해요. */
export function HeartButton({ on, onClick, label, size = 18, className = "", inverted = false }: Props) {
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      aria-pressed={on}
      aria-label={`${label} 관심 ${on ? "해제" : "등록"}`}
      className={`grid place-items-center rounded-full p-1.5 transition-colors ${inverted ? "" : on ? "text-brand" : "text-mute hover:text-brand"} ${className}`}
    >
      <Heart size={size} fill={on ? "currentColor" : "none"} aria-hidden />
    </button>
  );
}

export function FavShowButton({ showId }: { showId: string }) {
  const fav = useFavorites();
  const on = fav.shows.has(showId);
  return (
    <button
      type="button" onClick={() => fav.toggleShow(showId)} aria-pressed={on}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${on ? "border-brand bg-brand text-onbrand" : "border-line text-mute hover:border-brand"}`}
    >
      <Heart size={12} fill={on ? "currentColor" : "none"} aria-hidden />{on ? "관심 공연" : "관심 등록"}
    </button>
  );
}
