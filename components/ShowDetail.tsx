"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Clock, MapPin } from "lucide-react";
import type { Show } from "@/types/show";
import { buildIndex, period } from "@/lib/casting";
import Poster from "./ui/Poster";
import { StatusTag } from "./ui/Tags";
import { FavShowButton } from "./ui/HeartButton";
import CastingScheduler from "./casting/CastingScheduler";
import SessionSheet from "./casting/SessionSheet";
import EventsTab from "./EventsTab";
import AdSenseBanner from "./ads/AdSenseBanner";
import { ADSENSE_SLOT_DETAIL } from "@/lib/ads";

export default function ShowDetail({ show }: { show: Show }) {
  const idx = useMemo(() => buildIndex(show), [show]);
  const [tab, setTab] = useState<"cast" | "event">("cast");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [only, setOnly] = useState(false);
  const [open, setOpen] = useState<{ date: string; sid?: string } | null>(null);

  const toggle = (id: string) =>
    setSel((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const openSheet = (date: string, sid?: string) => setOpen({ date, sid });

  return (
    <div className="mx-auto max-w-3xl pb-10">
      <div className="px-4 pt-4">
        <Link href="/" className="inline-flex items-center gap-1 rounded-lg py-1 pr-2 text-sm font-medium text-mute hover:text-brand">
          <ArrowLeft size={16} aria-hidden />목록으로 돌아가기
        </Link>
      </div>

      <header className="flex gap-4 px-4 pb-4 pt-3">
        <Poster show={show} className="h-28 w-20 shrink-0 rounded-xl text-base" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <StatusTag status={show.status} />
            <span className="rounded-full border border-line px-2 py-0.5 text-xs text-mute">{show.genre}</span>
            <FavShowButton showId={show.id} />
          </div>
          <h1 className="mt-1.5 font-serif text-xl font-bold">{show.title}</h1>
          <ul className="mt-2 space-y-1 text-sm text-mute">
            <li className="flex items-center gap-1.5"><Calendar size={14} aria-hidden />{period(show)}</li>
            <li className="flex items-center gap-1.5"><MapPin size={14} aria-hidden />{show.venue || "극장 미정"}{show.region && ` (${show.region})`}</li>
            {(show.age || show.run) && (
              <li className="flex items-center gap-1.5"><Clock size={14} aria-hidden />{[show.age, show.run].filter(Boolean).join(" · ")}</li>
            )}
          </ul>
        </div>
      </header>

      <nav role="tablist" className="sticky top-11 z-30 flex border-b border-line bg-bg px-4">
        {([["cast", "캐스팅 스케줄"], ["event", "할인 & 이벤트"]] as const).map(([id, label]) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}
            className={`-mb-px border-b-2 px-4 py-3 text-sm font-bold ${tab === id ? "border-brand text-brand" : "border-transparent text-mute"}`}>
            {label}
          </button>
        ))}
      </nav>

      <main className="space-y-3 px-4 pt-4">
        {tab === "cast" ? (
          <CastingScheduler showTitle={show.title} idx={idx} sel={sel} only={only} setOnly={setOnly} toggle={toggle} selectMany={(ids) => setSel(new Set(ids))} reset={() => setSel(new Set())} onOpen={openSheet} />
        ) : (
          <EventsTab show={show} idx={idx} onOpen={openSheet} />
        )}
      </main>

      <div className="px-4 pt-6"><AdSenseBanner slot={ADSENSE_SLOT_DETAIL} label="상세 하단 광고" /></div>

      {open && <SessionSheet idx={idx} date={open.date} focusId={open.sid} sel={sel} only={only} toggle={toggle} onClose={() => setOpen(null)} />}
    </div>
  );
}
