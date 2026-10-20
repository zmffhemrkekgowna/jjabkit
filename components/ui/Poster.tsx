"use client";

import { useEffect, useState } from "react";
import type { Show } from "@/types/show";

/** 포스터 이미지가 없거나 불러오지 못하면 공연별 색상 포스터로 대신해요. */
export default function Poster({ show, className = "" }: { show: Pick<Show, "title" | "img" | "grad" | "poster">; className?: string }) {
  const [bad, setBad] = useState(false);
  useEffect(() => { setBad(false); }, [show.img]);

  if (show.img && !bad) {
    return (
      <div className={`overflow-hidden bg-line ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={show.img} alt={`${show.title} 포스터`} onError={() => setBad(true)} className="h-full w-full object-cover" />
      </div>
    );
  }
  return (
    <div
      className={`grid place-items-center overflow-hidden text-center font-serif font-bold leading-snug text-white ${className}`}
      style={{ background: `linear-gradient(160deg,${show.grad})` }}
    >
      <span>{show.poster.map((l, i) => <span key={i} className="block">{l}</span>)}</span>
    </div>
  );
}
