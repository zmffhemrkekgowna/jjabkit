"use client";

import Link from "next/link";
import { MapPin } from "lucide-react";
import type { Show } from "@/types/show";
import { period } from "@/lib/casting";
import { useFavorites } from "@/lib/favorites";
import { statusOf } from "@/lib/status";
import { useTodayKST } from "@/lib/useToday";
import Poster from "./ui/Poster";
import { StatusTag } from "./ui/Tags";
import { HeartButton } from "./ui/HeartButton";

/** 목록과 마이페이지가 함께 쓰는 공연 카드. 하트는 링크 바깥에 겹쳐 두어 서로 눌림이 섞이지 않아요. */
export default function ShowCard({ show, hit = [], hitNote = "", note = "" }: { show: Show; hit?: string[]; hitNote?: string; note?: string }) {
  const fav = useFavorites();
  const today = useTodayKST();
  return (
    <div className="relative">
      <Link href={`/shows/${show.id}`} className="group block">
        <div className="relative overflow-hidden rounded-2xl border border-line">
          <Poster show={show} className="aspect-[3/4] w-full text-xl" />
          <StatusTag status={statusOf(show, today)} className="absolute left-2 top-2" />
        </div>
        <h3 className="mt-2 font-bold leading-snug group-hover:text-brand">{show.title}</h3>
        <p className="text-xs text-mute">{show.genre} · {period(show)}</p>
        <p className="flex items-center gap-1 text-xs text-mute"><MapPin size={12} aria-hidden />{show.venue || "극장 미정"}</p>
        {note && <p className="mt-0.5 text-xs font-bold text-brand">{note}</p>}
        {hit.length > 0 && <p className="mt-0.5 text-xs font-medium text-brand">출연 배우: {hit.join(", ")}{hitNote && <span className="text-mute"> · {hitNote}</span>}</p>}
      </Link>
      <HeartButton on={fav.shows.has(show.id)} onClick={() => fav.toggleShow(show.id)} label={show.title} className="absolute right-2 top-2 bg-card shadow" />
    </div>
  );
}
